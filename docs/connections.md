# Read sources and native heating transport (development version)

These additions are in 0.1.0-beta.5-dev.0 source. The immutable published Beta 4 package
does not contain them. No production installation or actuator transfer is automatic.

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
