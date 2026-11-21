# Beta 9: long-term read-only acceptance

**Outcome: not accepted; production handoff remains blocked.** The planned window
ran from 2026-11-20 20:42:09 CET to 2026-11-21 20:42:09 CET. Its real elapsed
window is complete, but continuous 24-hour coverage and unchanged-service
stability were not established. The original evidence was retained throughout.

## Coverage and boundaries

The installed published Beta 9 and the manufacturer's pinned files matched the
verified baseline. The source-only installation had no executable functions,
actuator write mappings, native control transports or commissioning permission.
The temporary observer passively followed existing HmIP callbacks and read
allowlisted local status routes, existing state/context data and process/file
metadata. It sent no additional heating-cloud request, actuator command, house-rule
change, service lifecycle command or cooldown reset.

A control-computer power-saving transition broke the original SSH observation at
about 05:14 CET. A failed atomic local status replacement also left a stale running
indicator; it was reconciled against the actual process and evidence. The gap
between original records and resumed records was 71.63 minutes. A bounded temporary
memory buffer then retained the remaining source observation through another
control-computer disconnect. Host metadata still has explicit sampling gaps.
One runtime-status request timed out, producing a roughly ten-minute status-frame
gap; the subsequent status frame recovered.

There were 275 runtime frames, including start/end snapshots, and 150 complete
217-mapping compatibility frames before the later source pause. At least 16,393
samples of the nine context proofs recorded no bad sample. This does not fill the
measurement gap or certify uninterrupted physical behavior. Within each retained
segment the stream sequence was complete.

## Cloud limits and requested containment

Existing journals recorded HTTP 429 on `home/getCurrentState` at 07:14 and 10:12 CET.
The existing shared guard imposed its local two-hour, then four-hour cooldown.
The first recovery at 09:14 produced a fresh response with all 39 heating
projections valid. That recovery lasted less than one hour. The second planned
cooldown ended at 14:12. These durations and observed call counts do not establish
a provider quota or guarantee of recovery.

The observation recorded 2,460 valid and two rejected passive replies within the
planned window. The independent mirror replays relative retry intervals at a
later time; actual callback times and runtime diagnostics establish recovery,
not delayed mirror retry times.

At the operator's explicit request to reduce cloud calls, only AdaptiveHome's
additional HmIP read connection was disabled through live configuration at
10:18:44 CET. Its enabled flag and configuration audit metadata changed; source-only
scope, house rules, actuator bindings, native transports, manufacturer configuration,
installed product files and existing services were not changed or restarted.
The shared cooldown file was byte-identical during activation. Private backups,
conditional activation and two isolated checks retain the evidence.

No further AdaptiveHome HmIP request/reply was observed after the pause. Hook
counters remained at 351 status reads and eight profile reads through the end,
including more than six hours after the guard deadline. This establishes
containment of this additional reader, not zero cloud traffic from other existing
applications. The old additional polling remains disabled; a permanent passive
cache/event transport has not been implemented or installed.

The baseline observer deliberately stopped full compatibility-mirror evaluation
after this planned configuration change, while retaining actual runtime sources,
context proofs and hook diagnostics. A separate fresh end matrix, with heating
reads forbidden, found 128 valid, 40 stale, one invalid and 48 unavailable mappings.
Forty-seven unavailable mappings were intentionally paused heating inputs; one
optional source was missing. This snapshot is not a reconstructed 24-hour matrix.

## Remaining source and stability findings

- The HmIP read transport failed sustained operation. Existing manufacturer data
  and events need a passive integration with genuine freshness evidence and a
  shared bounded budget for any still-required cloud reconciliation. A read or
  process heartbeat must not refresh old measurements synthetically.
- A Hue light remained unreachable; identities/aliases matched. An initially
  rejected button recovered. Direct local Shelly projections were valid while
  older vendor-adapter caches remained stale; this is not general incompatibility.
- Optional vacuum, presence-radar, media and voice caches had stale/missing inputs.
  A dismantled optional appliance remained intentionally unreachable.
- Some PV updates advanced about every six minutes against a five-minute mapping
  limit; periodic freshness changes are not evidence of 30-minute provider polling.
  Two counters remained old. No deadlines were changed during observation.
- Raw weather and warning mappings were valid in the end snapshot. An anonymous
  reproduction against the exact published package confirmed a forecast-history
  defect: changes to an unused forecast point can reject unchanged fresh selected
  points in a persistent projector. A fresh projector accepts them. The passing
  negative control confirms the defect, not a repair; no correction was installed.
- An existing lighting worker restarted at 00:21 CET. Its 30-second watchdog is a
  possible explanation, but the precise exit cause remains unproven and maintenance
  provenance is unknown. An integration service had temporary health failures.
- An existing heating worker restarted at 14:30 CET, immediately after logging
  `Snapshot timed out`. No maintenance is known according to the operator; precise
  cause is unproven. It later continued its own normal commands. Neither restart
  was requested by this observation.

Final monitored package/manufacturer files, native instance configuration,
installation metadata, house-rule files and active flows matched the baseline.
The active own configuration matched exactly the requested reader pause. The
observer exited; its three temporary memory files were removed only after exact
local-copy/hash verification. Existing house automation continued its own commands;
zero observer commands does not mean that no actuator changed anywhere in the house.

## Validation and outstanding gates

Build and type checking passed, as did 197 product unit tests, eight observer/helper
checks and two disabled-reader checks. Premature finalization was rejected. The
single anonymous forecast negative control reproduced the unresolved defect.
Raw observations, private configuration, identifiers and backups remain ignored.
No public runtime change or new release was made for this observation.

The read-only installation remains active with additional HmIP polling disabled.
Continuous acceptance must be repeated after transport/source corrections. Physical
expiry, App priority and exclusive actuator handoff with rollback remain separate,
uncompleted gates. No productive actuator takeover is approved by this evidence.
