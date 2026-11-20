# Beta 9: 24-hour read-only acceptance

**Status: running, not yet accepted.** The actual observation started on 2026-11-20
at 20:42:09 CET. Its full 24-hour window cannot complete before 2026-11-21 at
20:42:09 CET. A short pilot, a running process or an intermediate report is not
a substitute for the full measured window and final integrity checks.

The installed public Beta 9, active source-only revision, manufacturer pins and
product files matched the previously verified installation immediately before
observation. The private hook is registered in read-only mode; all nine context
proofs were healthy. No product/configuration update or existing-service restart
is part of this acceptance task.

The temporary observer passively follows existing HmIP reads, samples the actual
runtime and original context/source times, and reads narrowly allowed local
status routes. It sends no additional heating-cloud read, profile request,
actuator command or rule change. It records service identities, health and
read-only integrity checks; raw data remains private. Its time-window, scope,
quality and command-boundary checks passed eight isolated helper tests.

Initial unresolved sources include two invalid Hue projections and stale or
unavailable optional raw values. PV values are additionally stale at the evening
start; weather and warnings are valid. These are initial findings, not 24-hour
results. The final report must distinguish sustained failures, recovery,
ordinary changes, concurrent maintenance and gaps in observation.

No repairs, quota resets, configuration changes or existing-service restarts
will be performed during this observation. Physical expiry, App priority and
exclusive actuator handoff remain separate acceptance gates.

## Intermediate stability finding

An existing lighting worker was observed restarting at 2026-11-21 00:21 CET.
Its container restart count increased once. An integration service temporarily
failed five-second health checks during elevated host load and subsequently
recovered without an observer restart action. The lighting worker contains a
30-second self-exit watchdog, consistent with a load-related timeout; its exact
exit cause is not proven because the older Docker lifecycle events had already
expired from the retained ring. No observer restart/kill/configuration command
was issued. Independent maintenance provenance is being clarified.

The full diagnostic observation continues to its original end time. This window
can no longer establish unchanged-service stability. Neither the restart nor
an intermediate source recovery will be hidden by resetting the observation.
Core read-transport/context failures have not been observed so far; this remains
an intermediate finding, not a completed 24-hour acceptance.
