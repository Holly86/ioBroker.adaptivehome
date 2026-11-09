# Device freshness and configurable policy behavior

These additive schema-v1 features are in the source after Beta 3. The immutable
`v0.1.0-beta.3` package does not contain them. Contract tests and controller
emulators do not establish physical hardware support.

## Event time and read evidence

`measuredAt` remains the event/sample timestamp. An unchanged event is not new
movement. `receivedAt` records the evaluation read, and optional `verifiedAt`
records a successful, device-scoped read that actually covered this value.

A mapping can select:

```json
{
  "freshness": {
    "verifiedAtId": "example.0.device.readCompletedAt",
    "reachableId": "example.0.device.reachable",
    "maxAgeMs": 30000
  },
  "eventTimestampId": "example.0.sensor.lastEventAt"
}
```

The example IDs are illustrative, not points created by Adaptive Home.

`writeValues` can restrict commands independently of readable `values`. For
example `[false]` authorizes OFF only while a real ON observation remains valid;
it does not grant ON or classify an already running device as invalid.
`verifiedAtId` must contain a confirmed epoch-millisecond timestamp for the
selected device/resource snapshot. It must cover the value being read. The
backend must update it after a successful read and propagate failures, rather
than refreshing a cached value on a timer. Adapter `alive`, a cached
`info.connection`, value `lc`, and a successful read of the ioBroker database
are not substitutes. Selecting a proof point does not implement its producer.
The optional reachable state may remain unchanged while the device read proof
advances. Without an explicit proof mapping, the original bounded `ts` policy
remains in force.

`eventTimestampId` accepts confirmed epoch milliseconds or ISO timestamps;
zone-less ISO timestamps are UTC (including Hue's native representation).
Null, invalid quality, future timestamps, stale proof, missing proof, or
unreachable devices never become healthy through this extension. Inputs and
final execution use the same normalization. Command acknowledgement still
requires new, correlated post-dispatch feedback; read evidence alone cannot
confirm a command.

## Light and house behavior

`parameters.holdMs` supports a twenty-minute quiet period independently of the
age of the unchanged motion event, provided fresh read evidence remains valid.
The runtime must observe continuous quiet. A gap longer than
`behavior.continuityMs` (default 30 seconds), unavailable motion, or lost
actuator evidence discards automatic ownership. No old timer is replayed after
restart, revision activation, or reconnection.

`luxThreshold` is a strict ON threshold. Optional `luxRearmAbove` supplies
hysteresis; values inside the band do not authorize a new ON. Illumination from
an automatically activated lamp does not immediately switch it off.

Optional `behavior` fields apply to explicitly selected light/equipment
functions:

| Field | Behavior |
| --- | --- |
| `manualOffQuietMs` | Manual OFF inhibits automation until a continuously observed quiet period finishes. Motion, loss and restart reset quiet evidence. |
| `manualSignals` | Input name plus explicit `offValues`; a new event timestamp counts even if its code repeats. The first sample is baseline only. |
| `manualSignatureInputs` | Selected dim/color/physical adjustment inputs relinquish automatic ownership when they change. Own declared activation feedback is excluded. |
| `awayOff` | One OFF on a confirmed home-to-away edge. The initial absent baseline does nothing. An earlier manual ON can end at the explicitly configured departure; a new hand action during preflight cancels it. Maintenance/inhibit and essential-service limits remain authoritative. |
| `welcomeHoldMs` | One dark welcome activation on an away-to-home edge. Motion extends the hold; only confirmed automatic ownership permits expiry. An existing manual light is not adopted. |
| `sessionOffMs` | A bounded session starts only after a new observed manual ON/adjustment. New hand input supersedes its lease. Startup or old stored wishes do not start a timer. |

Use `inputs.presence` for a shared, complete, debounced household observation;
set `absenceConfirmMs: 0` only when the selected source already confirms absence.
The core does not infer household truth from arbitrary device counts. Unknown
presence clears the edge baseline. An explicit room manual mode can use the
`inhibit` input. It is separate from a physical light switch event.

For a physical input whose edge is not an ON/OFF command code, select
`manualSignals[].useActuatorValue`. Its current confirmed output determines
manual ON/OFF; uncertain output conservatively inhibits automation. Dim/color
signature changes likewise use the actual output rather than assuming ON.

`activation` is a finite array of additional capability/value pairs on the same
physical binding. For example a supported RGBW output can select declared red,
green, blue, white and dimmer mappings. Components are written before the primary
ON. Only the Executor writes. Every component consumes budget and requires its
own correlated feedback before ownership. A partial result becomes uncertain
and is locked for reconciliation; it is not blindly completed. There is no
atomicity promise across separate backend points.

## Context-aware climate

Optional `climate` uses explicit base/comfort targets, local `comfortWindows`,
start-only `preheatMs`, optional `weatherBelow`, optional room usage hold,
humidity-constrained deep idle, additional weekly periods, and a bounded thermal
trial. Presence, selected individual presence, calendar permission, and window
inputs remain distinct. With this module selected, its schedules replace the
simple `rules` schedule path, so generic rules cannot bypass the climate gates.

Normalized input contracts:

| Input | Contract |
| --- | --- |
| `presence` | Confirmed household boolean; unknown preserves the preceding bounded native target. |
| `personPresence` | Optional individual boolean; unknown does not authorize comfort. |
| `weather` | A measured/validated forecast summary in °C, with its original coverage and expiry enforced by its producer; missing data selects base. |
| `calendarAllow` | Optional normalized calendar permission; confirmed false excludes regular comfort, unknown adds no exclusion. The producer owns coverage, local dates and selected calendar semantics. |
| `usage` | Current selected light/motion use; the policy owns the configured hold. Do not apply the same hold twice. |
| `temperature`, `humidity` | Actual measurements; deep idle requires valid humidity and a conservative projected relative humidity at its target. |
| `valve` | Confirmed maximum valve fraction 0..1, covering all selected thermostats. Missing data prevents a trial. |
| `window` | False means closed; open/unknown preserves the native window program. Omit only through explicit configuration. |

Thermal trials are available only with a verified native-program backend. They
stop after the configured horizon, at high valve opening, on measurement loss,
or after sufficient measured progress. They do not alter sensor offsets or
claim heat supply from setpoint acknowledgement. Each room remains independent.
The normalized source producers must actually exist before enabling a function;
these contracts do not create forecast/calendar/presence adapters.

## Native heating extension

`nativeProgram` plus mapping codec `nativeHeatingProgram` defines the finite
`adaptivehome.native-heating.v1` backend contract. The request includes physical
identity, profile ID, command ID, activation time, absolute expiry, timezone,
target, fallback, and all seven profile days. The compiler stops at the next
configured schedule boundary or the bounded horizon, uses a delayed activation,
and rejects an ambiguous DST fold. The backend must enforce absolute expiry
and prevent a spent weekly interval from recurring after an outage.

Optional `fallbackValues` enumerates additional permitted policy base targets.
When selected, climate forwards its actually evaluated base (including a
humidity-checked deep idle base) into the program. The compiler rejects any
fallback outside the explicit choices or hard bounds. Otherwise `fallback`
remains fixed. Thus a dynamic base is preserved during autonomous expiry
without granting an arbitrary new fallback temperature.

The report must echo the exact complete program and declare applied content,
automatic mode, autonomous fallback/absolute-expiry verification, app override,
download pending status and effective target. A matching scalar target alone is
insufficient. Pending/app override or missing guarantees block writes. Confirmed
content may precede delayed target activation; the runtime does not rewrite it
every tick. Backend confirmation and physical device verification remain
different levels. No party lease, new cloud session or installed driver patch
is used as a fallback.

Correlated native activation and autonomous fallback remain recognizable after
the short command acknowledgement deadline and across restart; they are not
mistaken for fresh human setpoint changes.

This is an **extension contract**, not a claim that the standard Homematic IP
adapter implements it. Its documented profile selection does not provide this
full-profile content/absolute-expiry transport. Ordinary thermostat setpoint
writes do not prove autonomous return. Until a real backend implements and
passes this contract, keep `backendContractVerified: false` and the relevant
function disabled. See the official [adapter source](https://github.com/iobroker-community-adapters/ioBroker.hmip/blob/master/src/main.ts)
and [API wrapper](https://github.com/iobroker-community-adapters/ioBroker.hmip/blob/master/src/lib/hmCloudAPI.ts).

Admin exposes these options as editable forms, including optional proof,
behavior, climate and native transport sections. Strict configuration validation
rejects missing inputs, contradictory hysteresis, unsupported activation
components and enabled unverified native transport. Private source identities,
calendar classifications, installation access and staged points belong solely
in the private configuration and its acceptance plan.
