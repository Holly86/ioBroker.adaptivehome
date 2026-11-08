import { randomUUID } from 'node:crypto';
import { Configuration, DecisionTrace, FunctionConfig, Intent, Observation, Scalar } from '../model/contracts';
import { normalize, StateMetadata, StateValue } from '../integrations/registry';
import { ExecutionJournal, Executor } from '../execution/executor';
import { Clock, systemClock } from './clock';
import { Supervisor } from './supervisor';
import { PresenceContext } from '../context/context';
import { History } from '../diagnostics/history';
import { commonDecision, noAction, PolicyDecision, PolicyMemory } from '../policies/policy';
import { lightingDecision } from '../policies/lighting';
import { airDecision, climateDecision } from '../policies/climate';
import { arbitrate } from '../execution/arbiter';
export interface HomePort {
    read(id: string): Promise<StateValue | null>;
    metadata(id: string): Promise<StateMetadata | null>;
    write(id: string, value: Scalar): Promise<void>;
    persist(key: string, data: unknown): Promise<void>;
}
export class HomeRuntime {
    supervisor = new Supervisor();
    readonly executor: Executor;
    readonly traces: Record<string, DecisionTrace> = {};
    readonly startedAt: number;
    private presence = new PresenceContext();
    readonly history = new History();
    private lastHistoryFlush = 0;
    private memories:Record<string,PolicyMemory> = {};
    private proposals:Intent[] = [];
    private ticking = false;
    private round = 0;
    constructor(private config: () => Configuration, private port: HomePort, readonly clock: Clock = systemClock) {
        this.startedAt = clock.now();
        this.executor = new Executor(config, {...port,persist: journal => port.persist('execution',journal),inputs: fn => this.inputs(fn)},clock);
    }
    async initialize(saved?: ExecutionJournal): Promise<void> { await this.executor.restore(saved);this.configure(); }
    configure(): void {
        this.supervisor.close();this.supervisor = new Supervisor();this.executor.invalidateAudit();
        this.memories = {};this.round++;
        for (const fn of this.config().functions) this.supervisor.register(fn.id,async () => { await this.evaluate(fn,this.round); });
    }
    async inputs(fn: FunctionConfig): Promise<Record<string, Observation | null>> {
        const result: Record<string, Observation | null> = {};
        await Promise.all(Object.entries(fn.inputs).map(async ([name,ref]) => {
            const binding = this.config().bindings.find(b => b.id === ref.entityId), mapping = binding?.capabilities.find(m => m.capability === ref.capability);
            let observation = binding && mapping ? normalize(binding,mapping,await this.port.read(mapping.readId),this.clock.now()) : null;
            if (observation && name === 'presence') observation = this.presence.evaluate(fn.id,observation,this.clock.now(),fn.parameters.absenceConfirmMs ?? 300000,fn.parameters.presenceConfirmations ?? 1);
            result[name] = observation;
            if(observation)this.history.observation(observation);
        }));return result;
    }
    async manual(functionId: string, value: Scalar, requestId: string, actor: string): Promise<unknown> {
        const fn = this.config().functions.find(f => f.id === functionId);if (!fn) throw new Error('unknown_function');
        const now = this.clock.now();
        const intent: Intent = {...fn.actuator,intentId:requestId,functionId,typedValue:value,origin:'manual',actor,reasonCode:'manual',reasonText:'Explicit manual request',sourceSnapshotId:randomUUID(),configRevision:this.config().revision,priority:800,validFrom:now,expiresAt:now + 10000};
        return this.executor.execute(intent);
    }
    async tick(): Promise<void> {
        if(this.ticking)return;this.ticking = true;
        try{
        this.proposals = [];await this.executor.expire();await this.supervisor.tick();
        const decisions = arbitrate(this.proposals,this.config());
        for(const intent of decisions.accepted){
            try{
                const command = await this.executor.execute(intent);const trace = this.traces[intent.functionId];if(trace)trace.command = command;
                if(intent.reasonCode === 'motion_on'){this.memories[intent.functionId].commandId = command.commandId;this.memories[intent.functionId].ownerManualAt = this.executor.journal.manual[command.physicalId]?.at ?? 0;}
                if(intent.reasonCode === 'motion_quiet_expired')delete this.memories[intent.functionId].commandId;
                this.history.event({at:this.clock.now(),type:'command',scope:intent.functionId,code:command.phase,revision:this.config().revision,commandId:command.commandId});
            }catch(error){const trace = this.traces[intent.functionId];if(trace){trace.reasonCode = error instanceof Error ? error.message : 'execution_failed';trace.reasonText = trace.reasonCode;}}
        }
        if(this.clock.now()-this.lastHistoryFlush >= 30000){this.history.rotate(this.clock.now());this.lastHistoryFlush = this.clock.now();
            try{await this.port.persist('history',this.history.record);this.history.storageError = false;}catch{this.history.storageError = true;}
        }
        }finally{this.ticking = false;}
    }
    private async evaluate(fn:FunctionConfig,round:number):Promise<void>{
        const config = this.config(), now = this.clock.now(),inputs = await this.inputs(fn),binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
        const mapping = binding.capabilities.find(c => c.capability === fn.actuator.capability)!;
        const actual = normalize(binding,mapping,await this.port.read(mapping.readId),now);
        if(round !== this.round || config.revision !== this.config().revision)return;
        const memory = this.memories[fn.id] ??= {}, wish = this.executor.journal.manual[binding.physicalId];
        const ownCommand = this.executor.journal.commands.find(c => c.commandId === memory.commandId);
        const owns = !!ownCommand?.feedbackMatched && ownCommand.generation === this.executor.generation && (!wish || wish.at <= (memory.ownerManualAt ?? 0));
        if(wish && wish.at > (memory.ownerManualAt ?? 0))delete memory.commandId;
        const context = {now,startedAt:this.startedAt,timezone:config.timezone,inputs,actual,owns,manual:!!wish && wish.until > now};
        const decision:PolicyDecision = commonDecision(fn,context) ?? (fn.kind === 'lighting' ? lightingDecision(fn,context,memory) : fn.kind === 'climate' ? climateDecision(fn,context,memory) : fn.kind === 'air' ? airDecision(fn,context,memory) : noAction('no_matching_rule','No configured rule currently applies'));
        const trace:DecisionTrace = {at:now,functionId:fn.id,configRevision:config.revision,reasonCode:decision.reason,reasonText:decision.text,inputs,nextStep:decision.nextAt ? new Date(decision.nextAt).toISOString() : undefined};
        this.traces[fn.id] = trace;this.history.event({at:now,type:'decision',scope:fn.id,code:decision.reason,revision:config.revision});
        if(decision.value === undefined)return;
        if(actual.quality === 'valid' && actual.value === decision.value){trace.nextStep = 'Already matches the requested value';return;}
        const intent:Intent = {...fn.actuator,intentId:randomUUID(),functionId:fn.id,typedValue:decision.value,origin:'configured_rule',actor:'policy',reasonCode:decision.reason,reasonText:decision.text,sourceSnapshotId:randomUUID(),configRevision:config.revision,priority:decision.priority,validFrom:now,expiresAt:Math.min(decision.expiresAt ?? now+10000,now+10000)};
        trace.intent = intent;this.proposals.push(intent);
    }
    async feedback(id:string,state:StateValue):Promise<void>{
        await this.executor.feedback(id,state);
        const command = this.executor.journal.commands.findLast(c => c.targetPath === id);
        if(command)this.history.event({at:this.clock.now(),type:'feedback',scope:command.intent.functionId,code:command.phase,revision:this.config().revision,commandId:command.commandId});
    }
    status(): unknown { return {functions:Object.fromEntries(this.supervisor.status),traces:this.traces,commands:this.executor.journal.commands.slice(-50),history:this.history.record.events.slice(-100),historyStorageError:this.history.storageError}; }
    close(): void { this.supervisor.close(); }
}
