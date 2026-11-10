# Read sources, optional data profiles and native heating transport

These additions are included in 0.1.0-beta.5. No production installation or actuator transfer is automatic.

## Read connections

In Admin's Import & channels view, add a read connection and its provided values.
Connections start disabled. Technical file locations and protected device access belong
in instance settings, separately from the exportable household configuration.

| Kind | Input | Freshness evidence |
| --- | --- | --- |
| json-file | Explicit native `sourceFiles` key | Declared timestamp inside the document; never file mtime |
| state-json | Exact acknowledged JSON state | Valid cache envelope plus declared document timestamp |
| state-map | Exact selected state IDs | Original value/timestamp/quality fields; no timestamp refresh |
| http-json | Explicit protected `sourceEndpoints` key | Successful finite GET response, or declared response timestamp |
| backend-json | Explicit HmIP instance with read extension | Successful existing-session server read, including original cached receipt time |

Outputs have a selected value path, type/unit/range, required source predicates, optional
event timestamp and optional source session. Paths are arrays of keys/indices, not code.
Conversions support scalar mappings, scaling, bounded JSON component decoding, complete
boolean aggregates, maximum valve fraction and complete equidistant forecast median.
Finite conditional cases can express optional calendar gates with configured local windows.
Unknown members cannot silently become false. A changed source session breaks continuity.
An unchanged physical value retains its event time while actual read proof may advance.
Missing, future, regressing, invalid or unreachable evidence cannot authorize control.

Each output provides virtual read paths:
`adaptivehome.<instance>.connections.<connectionId>.<outputKey>`, `.verifiedAt` and, when
declared, `.eventAt`. Reference these in capability mappings. Virtual paths are internal
read observations, not foreign writable states. Metadata is audited through the same port.
Optional reads run in the background with size/deadline bounds; healthy functions keep running.

For fixed HTTP reads, protected `sourceEndpoints` contains a JSON object such as:

```json
{"bridgeLights":{"kind":"hue-lights","backendRef":"hue.7"}}
```

The Hue reference reuses its configured bridge/application key. It never pairs or opens
a new vendor session. Direct endpoint definitions support `origin`, optional `user` and
`secret`, and one of `hue-lights`, `hue-sensors`, `shelly-status`, `shelly-rpc-status`.
Only the corresponding fixed read routes are constructed. Arbitrary URLs/actions and
redirects are rejected. Endpoints are encrypted/protected native settings and are absent
from ordinary configuration exports. File keys only resolve explicitly declared native paths.
Private paths, credentials, subjects and device identities must never enter public fixtures.

## Backend-hosted HmIP extension

The SDK exports `HmipSessionSource` and `HmipNativeEndpoint`. A maintained backend integration
must register `adaptivehomeRead` and `adaptivehomeNative` on its own message interface,
using the existing authenticated API object. Do not patch installed adapter files.
The current standard HmIP adapter does not register these messages; it is not upgraded by
installing Adaptive Home. Cached process liveness is not a device-read receipt.

`HmipSessionSource(api, clientCharacteristics)` performs `home/getCurrentState` reads through
that existing client. Its shared cache retains the real read timestamp, filters response
fields, validates home/group/profile/member identity and reads full profile contents.
`handleRead(actualMessageSender, allowedSenders)` returns the selected source document.
Host the integration behind an explicit sender allowlist and normal backend permissions.
Full profile contents carry their own real read time (`profileCheckedAt`) and configured
`profileMaxAgeMs`; cached reads do not renew it. Route backend profile-change events to
`invalidateProfile(groupId)` for immediate reinspection. Configure read cadence/budgets with
the backend's real limits; the shared cache is not a claim about manufacturer quotas.

Create `HmipNativeEndpoint(targets, port, clock, savedJournal, allowedSenders)` with trusted
target definitions and call `handle(message, actualMessageSender)`. Use the real message
sender, never a sender field supplied in the payload. The port can delegate `snapshot` and
`callRestApi` to the same `HmipSessionSource`. The host supplies durable persistence and an
independent exclusive-writer/authority check; Node-RED is not a dependency of this protocol.
No cloud authentication, credentials or extra vendor client are implemented in the extension.

`nativeTransports` declares backend, group, physical identity, exact profile index, complete
member IDs and temperature limits. A native mapping uses the virtual `.native.<id>.report`,
`.command` and `.verifiedAt` paths. Only Executor reaches the command port after its usual
revision, input, manual-priority, budget and authority checks. Imported protected paths must
match a declared transport and physical binding. Disabled transports never send requests.
Executor's actual dispatch deadline travels with the request. The backend checks it again
after asynchronous preparation and forces uncached control/profile reads before a mutation;
it cannot extend a request simply because a native program has a later activation or expiry.

The backend validates the exact absolute-minute program including DST and fallback, retains
profile identity/name, reads before and after a complete `updateProfile`, and tracks each
member's pending/configuration and target reports. Cloud acceptance alone is not confirmation.
Persisted uncertain/in-flight requests block blind retries, including after restart. Command
IDs are correlated, replays cannot change content, local mutation limits persist, and app
party/boost/manual modes are preserved. Inspecting cached status does not create cloud polling.
Profile identity is checked against the persisted pre-write baseline, not reconstructed from
the latest possibly replaced profile. Journal capacity is bounded and fails closed when full.

**Absolute expiry remains a real capability requirement.** HmIP weekly programs repeat.
A weekly end time is not an absolute once-only expiry, and a process timer cannot provide
autonomous fallback after controller loss. The endpoint rejects elevated transfers before
any vendor write unless `port.expiry` supplies a matching device/server-enforced installation
and readback proof. The standard HmIP implementation provides no verified facility here.
The optional port is tested with a synthetic independent expiry facility, not certified hardware.
If a backend cannot provide it, retain `backendContractVerified: false` and keep control disabled.

Physical acceptance must verify actual download, delayed activation, app intervention, expiry,
no recurrence the following week and operation after controller loss. A source draft and
successful anonymous tests do not complete those checks. During migration, shared read sources
must survive stopping old writers; access/mount changes and the writer handoff are separate work.

## Optional cache-only adapter profiles (Beta 5)

Select discovery candidates for `mihome-vacuum`, `radar2`, `solarmanpv`,
`openweathermap`, `nina`, `harmony` and `alexa2`. These profiles read existing
ioBroker states only; they never start a device session, poll a cloud service,
run a command or obtain credentials. Instance numbers are discovered dynamically.

| Profile | Selected observations |
| --- | --- |
| mihome-vacuum | Battery, state/error, charging, cleaned area/time |
| radar2 | Individual device presence and last-seen feedback |
| solarmanpv | Power, daily/total energy and temperature with exact units |
| openweathermap | Current/forecast temperature, humidity, wind, pressure, precipitation and validity time |
| nina | Warning counts, severity and selected warning text |
| harmony | Hub connection/block status and current activity feedback |
| alexa2 | Online and selected player/media feedback |

Read-only mappings reject write paths. Discovery excludes button controls, commands,
authentication data, maps, routines and voice history. A writable metadata flag on a
feedback state does not grant writes. Values require `ack:true`; missing/null values,
wrong units/types, poor quality and expired timestamps remain unavailable/unknown or
stale. A fresh cache read does not manufacture a fresh physical measurement.
Weather defaults to a two-hour age bound, other new profiles to five minutes; review
these bounds against the selected backend's actual reporting schedule.

Add an enabled `sources` entry referencing a selected binding/capability to process
and display its observations without an actuator function. This also supplies local
history/learning input and optional SQL export. Explicitly map suitable observations
into a function's supported input if it should affect a rule. Media activity and
radar device presence do not automatically establish household occupancy. Forecast
points retain their forecast validity; they are not current temperature measurements.
NINA is supplementary information and does not replace an official warning channel.

### SQL logging / SQL-Protokollierung

SQL is the optional external history backend. Install/configure `iobroker.sql`
separately, then select its exact instance under Import & channels → Logging.
The adapter starts with `logging.enabled:false`. No database access is required
for classical control, local history or the new read profiles. Influx is not a
second implemented backend in this release.

```json
{"logging":{"enabled":false,"adapter":"sql.0","observations":true,"events":true,"maxQueued":1000,"batchSize":25,"flushIntervalMs":5000}}
```

The adapter sends generated observation/event JSON through SQL's `storeState` API,
only for its own `adaptivehome.<instance>.telemetry.*` string datapoints. It does
not enable foreign history settings or accept arbitrary SQL. Original timestamps,
quality and source remain in the JSON; SQL row timestamps are unique ingestion times.
SQL 3.0.1 with SQLite is tested against an actual isolated database. Other SQL
dialects follow the same backend API but have not received database integration tests.

A bounded queue and journal retain temporary offline data. Admin status exposes
queued/uncertain/dropped counts. There is no claim of lossless or exactly-once
storage: a full queue drops new rows visibly, and a process crash before the next
journal flush may lose recent rows. An ambiguous/partial SQL acknowledgement blocks
replay across restart (`reconciliation_required`). Preserve the journal and compare
its IDs/timestamps with the SQL history before administrator reconciliation; do not
blindly replay or delete it. Changing the destination while records are queued also
blocks automatic rerouting. Disabling logging stops export, without deleting history.
Retention and database backups are managed in the SQL installation.

Die neuen Profile lesen ausschließlich ausgewählte vorhandene Zustände. Unter
„Import & Kanäle“ werden Quellen und die optionale SQL-Instanz eingerichtet.
Ohne aktiviertes Logging erfolgen keine Datenbanknachrichten. Geräteanwesenheit,
Wettervorhersage und Medienstatus werden erst durch ausdrückliche Zuordnung zu
passenden Regeleingängen steuerungsrelevant. Im Lese-/Shadow-Pilot bleiben
Aktorfunktionen und SQL-Export deaktiviert.

## Readiness corrections in Beta 6

The following additions are included in Beta 6. Earlier release tags and assets
remain unchanged. They do not install, restart or alter an existing backend.

Protected source credentials can reference an existing explicitly declared native
`sourceFiles` entry. Example instance setting (synthetic endpoint):

```json
{"kind":"shelly-status","origin":"http://127.0.0.1/","credentialFile":{"key":"deviceAccess","userField":"username","secretField":"password"},"expectedDevice":{"mac":"AABBCCDDEEFF","model":"synthetic-relay"}}
```

Keep the referenced JSON private (owner-only permissions), separately from configuration
exports. The file contains the selected username/password keys. The runtime resolves
those fields in memory and returns no credentials in source documents or diagnostics.
A Shelly status read with expectedDevice first checks the fixed `/shelly` identity
route (Gen 2: `/rpc/Shelly.GetDeviceInfo`) and rejects a different MAC/model before
querying status. Hue still checks the configured unique resource identities in outputs.
No arbitrary action URL, redirect, pairing or authentication session is introduced.

State-map outputs may declare `timestampPaths` for all contributing values. Every
receipt must be valid and the oldest is retained as evidence; polling never renews it.
Forecast outputs can supply `forecast.points`, each with at/minimum/maximum selectors
and contributing timestamp selectors. The runtime selects the next declared number of
future samples, requires exact cadence and configured horizon coverage, and computes
the median of each min/max midpoint. Missing, out-of-order, duplicate, expired, future
receipt times or incomplete coverage fail closed. Twenty-four three-hour forecast points
span 69 hours between the first and last point; do not label that as independently proven
continuous 72-hour measurement coverage. These selectors are editable in Admin.

### Maintained backend registration

The SDK now exports `createHmipBackendHost` and `registerHmipBackendHost`:

```ts
const host = registerHmipBackendHost(adapter, {
  api: existingAuthenticatedApi,
  clientCharacteristics: existingClientCharacteristics,
  allowedSenders: ['system.adapter.adaptivehome.7'],
  targets: reviewedTargets,
  mode: 'read-only',
});
// During backend shutdown: host.close();
// On a real profile-change event: host.invalidateProfile(changedGroupId);
```

The host registers adaptivehomeCapabilities, adaptivehomeRead, adaptivehomeProfileRead and adaptivehomeNative.
Unrelated backend handlers are preserved. Registration starts no REST call or cloud
session. Read-only mode rejects apply requests before any vendor mutation and ignores
execution journals; capabilities explicitly report no control or physical acceptance.
A control host additionally requires independent authority and durable persistence ports;
a real absolute-expiry provider is still required for elevated one-shot profiles.

Real HmIP getProfile responses omit name/index and group metadata uses profileId.
The reader verifies home/group/profile IDs and enabled status, checks a complete heating
week, and supplies name/index only from independently verified group metadata. Conflicting
aliases or response claims fail closed. Profile readback uses the same normalization.

This is a backend integration API, not a patch installer. A maintained backend release
must explicitly register it on its existing authenticated API. Installing this adapter
alone cannot add missing commands to an already running foreign process. Private cache
inspection, software contracts and physical expiry/actuator acceptance remain separate.

For declared time-derived case/forecast outputs, an evaluated value may change when
a configured window or selected forecast interval advances. Its evaluation/event time
is kept separate from the unchanged source receipt. Identical-receipt source-content
changes and backwards evaluation clocks remain rejected. A partial aggregate refresh
may remain unavailable until its oldest contributing receipt advances; this is a
conservative failure rather than invented freshness.

### Independent context observations

An operator-hosted read-only producer can use the SDK's pure `manualRequest`,
`rgbHue`, `roomUsage`, `calendarAvailable` and `ReadPresence` projections. These
functions have no I/O or command port. Persistent human requests must come from
the authoritative request store; an unreadable store is unknown. Room usage keeps
the configured primary/auxiliary light and motion semantics. RGB hue is calculated
from validated direct feedback. A process heartbeat cannot renew per-person evidence:
negative presence requires actual fresh per-device scan receipts through the whole
absence delay. Unknown input, a new scan session or an observation gap resets that delay.
Corroboration of a hallway event uses the original event time.

`calendarAvailable` source outputs select an independently fetched calendar document
and declare `calendar` rules: timezone, maximum age, an away-event kind, and optionally
school departure/return times, same-day group-event kind, explicit public holidays and
finite inclusive school-holiday/coverage dates. Calendar events have kind, allDay,
start and exclusive end. Stale, incomplete or malformed calendars remain unknown.
This is a declared clock-derived projection: time boundaries may change availability
without renewing the original calendar fetch receipt. Source-content changes with an
identical receipt remain rejected. Optional calendars do not authorize any actuator.

`adaptivehomeProfileRead` accepts only `{protocol: 'adaptivehome.profile-read.v1',
targetId: '<enabled configured target>'}` from the host's allowlist. It returns a validated
full snapshot/profile through the existing session, even when native control acceptance
is pending. It never implies verified autonomous expiry or physical acceptance.
The SDK's `readOnlyHmipPort(existingApi)` provides a second unconditional boundary:
only home/getCurrentState and group/heating/getProfile reach the original API, using
strict error propagation and a bounded timeout. Registration and profile inspection
create no authentication client and do not modify existing backend handlers.

A private deployment hook is installation-specific lifecycle evidence, not a generally
supported foreign-adapter installer. Pin its exact backend version/hash, preserve vendor
files and existing configuration, derive filesystem ownership from the real runtime user,
test loading under that user before restarting, and keep a scoped rollback. Scanner
evidence must cover the installation's actual probe method; an absent ARP scanner or a
failed ping must never be reported as a successful negative device observation.

### Native dated leases (Beta 6 SDK contract)

A function's nativeProgram and its nativeTransports entry must both select strategy
`timed-lease`. The function uses activationDelayMs 0, a maximum horizon of 900000 ms
and a fixed commissioned fallback. Elevated targets are sent only through Executor,
the configured native transport and HmipTimedLeaseEndpoint on the existing authenticated
backend API. The endpoint uses group/heating/activatePartyMode with an absolute local
endTime; it never edits a weekly profile, queues a future activation or starts an expiry
timer. End dates round down to five-minute boundaries. DST transitions are refused.

Every selected profile must already be a verified constant fallback, including every
member. A target-specific TimedLeaseAcceptance binds home identity, profile fingerprint,
membership, expiry of the acceptance and separately recorded evidence for internet loss,
access-point restart, shared deadline, app priority, windows and cloud traffic. Register
persistTimed as a durable journal. Missing physical acceptance remains a blocking
condition; an installed read-only host still refuses every apply request unconditionally.
The original weekly-profile strategy still requires an independent real expiry provider.

The cloud exposes a shared party deadline. Additional automatic rooms can join only at
that exact deadline: this interface never lengthens or shortens another room's lease.
A live owned lease is not overwritten. An app party, manual/boost mode, vacation, unknown
owner or changed shared deadline prevents automatic writes. App changes to the common
deadline can affect all active party rooms; they are treated as human overrides, never
corrected by silently cancelling or changing another room. This tradeoff must be selected
explicitly before commissioning. After restart, active old leases are not adopted for
new writes. The native end remains in place; no old command queue is replayed.

The full profile and shared end date are read back. Individual post-dispatch device
timestamps and configPending values determine devicePending separately from server
acceptance. An uncertain write is journaled and blocks blind retries. Once the native
end passes, fresh group/member fallback feedback is required; the unchanged constant
profile has no elevated period that could recur next week. No offline hardware claim
is implied by simulator evidence.

The SDK also exports inspectHandoff and handoffTransition. These are pure proposal
functions with no lifecycle or actuator port. Their finite plan binds package/configuration
hashes, target scope, native/physical evidence, fallback fingerprints and manual revisions.
Old-writer scope must be covered completely. Stop the old writer and positively verify
its stop before proposing the new start. Persist each transition before acting. Rollback
first stops and verifies the new writer; baseline restoration must use Executor with
the proposed compare-and-swap/manual guards. Changed manual wishes or profiles require
review and must not be overwritten by an old backup. Only then may the former writer
resume while adopting current manual wishes. No proposal or shadow result is a live
activation permission.

The [manufacturer user manual, section Partymodus](https://homematic-ip.com/sites/default/files/downloads/Homematic_IP-Anwenderhandbuch.pdf) describes return to the previously selected profile when the party period ends. That product behavior motivates the constant fallback; it does not certify an installation's offline behavior, shared deadline, API route or firmware. Those checks remain explicit commissioning evidence.

Timed acceptance also binds the home's validated timezone, and must remain valid through the requested end. The backend reports an existing owned sharedDeadlineAt; Executor clamps joining-room plans to that deadline and refuses an incompatible earlier room cutoff. A reservation that fails before any vendor invocation is recorded as not-sent, distinct from an uncertain vendor result. Neither path replays the failed command.

Rollback proposals wait for the native lease to expire and for fresh fallback feedback; they do not cancel the shared party slot. Stopping an adapter is not treated as expiry. A newer manual/profile revision blocks automatic restoration and requires an explicit baseline review preserving the current human wish.

## Manual commissioning and executable handoff after Beta 6

Beta `0.1.0-beta.7` adds an explicit manual commissioning executor,
a durable handoff coordinator, registered lifecycle providers, journal transfer and
a constant-profile recovery executor. Earlier beta packages remain unchanged. Nothing
installs these services into an existing backend or activates a house writer.

### Bounded manual commissioning

A maintained backend can explicitly select `mode: 'commission'` and provide
`commissioning: { grant, authority, persist, saved }`, plus the existing session,
enabled native target list, fixed allowed senders and exclusive-writer authorization.
The default remains read-only. Commission mode rejects routine native apply;
control/read-only modes reject `adaptivehomeCommission`. No physical certificate
is fabricated. Commission responses have a separate protocol, `routineControlReady:
false` and `physicalAcceptanceGranted: false`; even their internal native report
has absoluteExpiry false. Normal native connections cannot consume them as proof.

`commissioningGrantSchema` binds one operator, home, timezone, configuration/package
hashes, physical targets, profile hashes, exact membership, discrete allowed
temperatures, a finite list of step IDs, a command count and an expiry. A grant lasts
at most one hour, allows at most sixteen commands and eight selected targets, and
limits each native lease to at most fifteen minutes. The regular five-minute end
grid, constant fallback, local spacing/budget, shared-deadline, App/window/manual
protection and original device-feedback checks remain in force. No weekly comfort
periods are uploaded and no adapter timer claims physical return.

The trusted `authority()` callback must independently verify current on-site operator
acknowledgement, grant identity, unrevoked scope, configuration/package identity and
exclusive ownership. Its original acknowledgement must be at most thirty seconds
old. A backend heartbeat is not attendance; returning current time and true without
checking the operator/owners would violate this contract. Authorization is checked
again immediately before dispatch. Initial hardware evidence is deliberately absent;
the operator supervises this limited manual trial and separately records its outcome.

Each manual request uses protocol `adaptivehome.commission.v1`, operation step or
inspect, grantId, operator and targetId. Step additionally requires its granted
stepId, a finite timed-lease program and dispatch deadline. Unknown fields, values,
operators, targets and steps are rejected. Reservations precede any actor send;
denied/ambiguous steps are not automatically retried. Restored sessions can inspect
but cannot resume commissioning. Request/authority/storage timeouts are bounded;
late preflight responses cannot dispatch after a timed-out step. A send already
offered to an external API may remain uncertain, so no cancellation/exactly-once
claim is made and native fallback still needs physical acceptance.

The adapter's Admin-only commission/handoff gateway starts with native settings
`commissioningEnabled: false` and `commissioningBackend: ''`. An operator must
explicitly configure one maintained hmip instance. Requests use the standard
requestId/expectedRevision/expiresAt operation envelope and nested request object.
The gateway supplies the actual Admin sender as operator, never an operator name
from untrusted payload. Existing remote-control clients cannot enter this path.
The backend must independently bind its grant to that operator; granting the
gateway alone grants neither device writes nor lifecycle authority.

### Executable handoff and recovery

`HandoffCoordinator` executes activate and rollback against an immutable finite
handoff plan. It stores each action reservation before calling
`RegisteredHandoffExecutor`, verifies actual read-back, and records completed or
uncertain results. The executor accepts only statically registered writer identities,
whole physical scopes and reviewed restore recipes; plans contain no shell commands,
scripts, paths or implementations. Old owners are stopped and positively observed
before new owners start. A comfort-only selector is not a per-device exclusion.

Observation must cover every target exactly once, report fresh owner state and
bind manualRevision to the latest explicit manual wish. `mergeManualWishes` keeps
the newer original wish; conflicting same-time wishes require review. Before an
owner starts, the executor checks destination wishes, imports them, reads them
back and rechecks current authority, manual/profile identity, physical gates and
the operation deadline. Import providers must compare the expected destination
hash atomically under their ownership fence. Newer destination wishes cannot be
overwritten. False/OFF, original times, holds and unrelated journals are preserved;
quiet-progress timers restart instead of inheriting old verified quiet time.

Concrete providers include fixed-instance ioBroker enable/alive verification and
a fixed-container Docker Engine client. The latter accepts an explicit local socket
or loopback endpoint and immutable full container ID; only inspect, start and stop
routes exist. No Docker socket is discovered, mounted or contacted automatically.
Socket access is an operator deployment decision; use a restricted maintained proxy
where appropriate. The caller must implement the ioBroker setEnabled API as a
guarded update of that exact instance's common.enabled, preserving native settings.
Liveness is checked separately from configuration acceptance. Docker endpoint
conformance is tested with an isolated API emulator and real child processes, not
certified against a production Docker daemon by those tests.

`MaintenanceStore` supplies an explicit absolute-directory owner lock, fsynced
atomic journal replacement, serialized updates and a four-MiB record limit. A crash
leaves the lock and reserved actions remain uncertain. Recovery requires the exact
old lock hash and independently verified stopped-owner proof; never replace that
callback with an unconditional true. An exclusive `opening.lock` serializes the
entire open/recovery sequence, including the asynchronous stopped-owner check.
An abandoned opening marker also denies new opens; it requires separate offline
inspection with all maintenance owners stopped and is never removed by age.
POSIX directory fsync is used; Windows lacks
that directory guarantee. `ManualWishBridge` updates an already existing own
execution journal transactionally under that lock, preserving unrelated commands,
budgets and uncertainty records. Other legacy request-store formats require a
registered, scoped import provider using the same compare-and-set contract.

Rollback stops the new owner first, then waits for actually observed native expiry
and fresh feedback even if the activation plan has expired. `constantProfileRestoreRecipe`
uses the existing-session updateProfile path with current identity, manual revision,
stopped-owner and native-state checks. It refuses recurring historical schedules;
updated profiles and original member timestamps must confirm restoration. Delayed
or missing feedback remains uncertain rather than being reported as device success.
Fresh restore recipes expire within five minutes. Alternatively an explicit review
hash can retain the currently verified safe baseline and import current wishes
before the old owner resumes; it does not grant physical acceptance.

Restored coordinators never replay activation. Uncertain effects require explicit
fresh reconciliation and do not trigger blind retries. Reconciliation additionally
requires the trusted provider's `reconcileQuiescent(actionId)` receipt that the
original request has settled. A stopped process alone does not rule out a delayed
start/stop arriving later. Without that proof the action remains uncertain and
automatic progression stays blocked. A newly observed restart of
the intended-to-be-stopped new owner permits a new journaled stop on an explicit
rollback call; it never replays a start. Read-only inspect exposes the current review
hash. `handleHandoffControl` binds activate/rollback/reconcile/inspect to the stored
plan hash, operator and short request deadline. A maintained host serves this only
when control mode and its coordinator are explicitly registered. Actual lifecycle,
manual-import and recipe providers must be installed and scoped for the target
environment; these services are not a universal foreign-controller installer.

The software checks use synthetic homes and isolated processes/controller databases.
They do not perform physical expiry, HAP/network interruption or house takeover.
