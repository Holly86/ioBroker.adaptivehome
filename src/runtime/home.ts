import { randomUUID } from 'node:crypto';
import { Configuration, DecisionTrace, FunctionConfig, Intent, Observation, Scalar } from '../model/contracts';
import { normalize, StateMetadata, StateValue } from '../integrations/registry';
import { ExecutionJournal, Executor } from '../execution/executor';
import { Clock, systemClock } from './clock';
import { Supervisor } from './supervisor';
import { PresenceContext } from '../context/context';
import { History } from '../diagnostics/history';
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
    constructor(private config: () => Configuration, private port: HomePort, readonly clock: Clock = systemClock) {
        this.startedAt = clock.now();
        this.executor = new Executor(config, {...port,persist: journal => port.persist('execution',journal),inputs: fn => this.inputs(fn)},clock);
    }
    async initialize(saved?: ExecutionJournal): Promise<void> { await this.executor.restore(saved);this.configure(); }
    configure(): void {
        this.supervisor.close();this.supervisor = new Supervisor();this.executor.invalidateAudit();
        for (const fn of this.config().functions) this.supervisor.register(fn.id,async () => { await this.inputs(fn); });
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
        await this.executor.expire();await this.supervisor.tick();
        if(this.clock.now()-this.lastHistoryFlush >= 30000){this.history.rotate(this.clock.now());this.lastHistoryFlush = this.clock.now();
            try{await this.port.persist('history',this.history.record);this.history.storageError = false;}catch{this.history.storageError = true;}
        }
    }
    async feedback(id:string,state:StateValue):Promise<void>{
        await this.executor.feedback(id,state);
        const command = this.executor.journal.commands.findLast(c => c.targetPath === id);
        if(command)this.history.event({at:this.clock.now(),type:'feedback',scope:command.intent.functionId,code:command.phase,revision:this.config().revision,commandId:command.commandId});
    }
    status(): unknown { return {functions:Object.fromEntries(this.supervisor.status),traces:this.traces,commands:this.executor.journal.commands.slice(-50),history:this.history.record.events.slice(-100),historyStorageError:this.history.storageError}; }
    close(): void { this.supervisor.close(); }
}
