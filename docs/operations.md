# Operations, data and rollback

The Overview separates desired values, reported states and data quality. Technical details include
command IDs, acceptance, backend/device evidence, source age, revision and decision reasons. Room
heat demand is not proof of available heat; compare actual room response. An unknown command locks
only its physical output. Inspect connectivity and selected feedback, obtain a fresh matching report,
then reconcile and resume. Never force repeated cloud writes to manufacture synchronization.

Manual commands set durable priority for the configured interval. External state commands and
observed device changes also preserve human control. Removing manual priority is explicit. Pausing
learning does not stop classical rules. Disable a function/instance to stop its automated commands;
devices retain their own native behavior and may retain the last value.

Before updates export configuration and take an ioBroker backup. Pause learned overlays, stop the
instance, install the new built package, upload Admin files and restart. V1 configuration is stored
as complete revisions in configuration.record; missing additive fields receive validated defaults.
Unsupported schema versions are rejected rather than silently converted. An imported draft does
not overwrite an active configuration before validation/activation. Previous configuration creates
a new revision; it does not overwrite newer manual wishes or replay old device queues.

For package rollback stop the instance, reinstall a previous tested artifact and upload its Admin
files. Restore a compatible private backup if a future release changes schema. There is no earlier production release. Beta 1 has a known ambiguous-ownership issue; it is not a workaround for overlapping functions. Ownership must remain exclusive through takeover and rollback.

Local history is bounded to seven days and 10,000 rows. Old/malformed rows are dropped, with counts.
Clear history deletes observations; model, adaptation, command, incident and replay journals remain
separate records. For full removal stop the instance and delete its data through ioBroker. Preserve
command/replay/budget records during ordinary restarts: deleting them loses previous reservations.
A corrupt provider budget disables provider calls. A corrupt operation journal blocks new operator
mutations while classical control continues; restore the private journal from a valid backup.

No telemetry is enabled. The optional provider receives only the explicitly allowed model-quality
summary and configured parameters/ranges, never a raw history upload. Configuration exports exclude
notification routes by default but contain installation identifiers and remain private. Support export
is deliberately minimal: reason-code statistics and quality counts, without observations, IDs,
recipients or free-text errors. Review any additional material manually before sharing.

Metered energy, numerical power integration and model estimates are separate categories. Missing
coverage/gaps remain visible. No environmental causality or household savings has been demonstrated.
Native thermostat programs, expiry and safety hardware must be checked on the exact model separately.
