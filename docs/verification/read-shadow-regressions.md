# Read/shadow regression corrections (2026-11-18 preparation)

This is the historical pre-release record. Publication and the subsequent controlled timeout investigation are recorded in [Beta 8 release verification](beta8-release.md); the observations below describe the earlier preparation.

The development source corrects issues reproduced with anonymous fixtures:

- Trusted time-derived projections retain the original source proof while their
  local value-change time advances. Calendar and rolling-forecast normalization
  now works on first evaluation and after time boundaries. Foreign states cannot
  supply the internal provenance marker; stale/future/inconsistent evidence stays
  invalid.
- Repeated missing/invalid null observations no longer fill history using a new
  read-attempt timestamp. Source and quality transitions and actual new
  measurements/proofs remain recorded. Unchanged history is not reserialized at
  every flush; storage failure remains retryable.
- NINA discovery accepts textual and numeric severity. New mapping age defaults
  are 20 minutes for NINA and ten minutes for SolarmanPV; configured mappings are
  not silently migrated and original timestamps are not changed.
- Shared-session read failures preserve only finite status/wait diagnostics.
  Producer and consumer pacing respect provider minimum waits, including waits
  longer than a day. HTTP Retry-After dates and seconds are supported. Concurrent
  reads are bounded, earlier successes cannot erase newer failures, and closed
  backend registrations do not send late replies.

Build, typecheck, lint, 191 unit/contract checks and 61 package checks passed.
The local, unpublished correction archive was installed in an isolated Windows
js-controller 7.2.5 using Node 24.22.1. All 126 installed runtime/Admin files match
the frozen archive. Two controller scenarios passed: safe backend rejection,
minimum retry wait and recovery without actuator commands; and source-only
processing of derived evidence, textual severity and a genuinely missing state.
The recovery scenario passed an additional fresh-install repeat. The initial
candidate run had one recovery timeout; its separate retry passed, and the final
candidate passed both the combined run and the repeat. The initial timeout's
cause was not established; no sustained stability claim is derived from these
short checks.

Private reader implementation and installation data remain ignored. Anonymous
file-only checks cover concurrent generations, transient and permanent publication
gaps, evaluation after reads, real future timestamps, rollback of the clock and
old reports. Real PC fixture files were updated concurrently for 30 cycles; the
reader did not change its input files. A separate local reader process was also
checked. Seven additional private loader/API/cooldown fixture checks verify pins,
existing-session reuse, read-only rejection, handler cleanup, API replacement and
persistent shared cooldown. These checks sent no requests to physical devices.

The private source-only configuration and hash-pinned backend hook are prepared,
not deployed. No production configuration, actuator or existing service lifecycle
was changed for these corrections. Unavailable devices, real provider recovery,
NAS load/restart causes, physical native expiry, full rule parity and actual
handoff/rollback remain separate acceptance requirements. There has been no new
24-hour live run, beta release, npm publication or ioBroker registry acceptance.
The published Beta 7 archive remains unchanged.
