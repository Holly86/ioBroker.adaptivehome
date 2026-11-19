# Beta 8 source-only installation

The explicitly authorized installation used the unchanged published Beta 8
archive and a separately maintained private read-only backend hook. Every
installed product file matched the frozen release manifest. Existing NINA
freshness windows were adjusted to the backend polling interval; unrelated
source settings, additional discovery proposals and the private context reader
were not changed.

A fresh official online backup was downloaded and its database contents were
restored on the development PC using the controller's original JSONL restore
implementation. The connection transition remained bound to the isolated local
database; no legacy adapter or controller service was started. File and metadata
rollback was tested separately, including actual scoped Admin uploads, interrupted
publication boundaries and preservation of newer independent operator data.

The first operator-installer attempt assumed that optional controller process
telemetry was available. Its startup check failed and the scoped backout restored
the exact baseline. The installer was corrected to inspect actual target process
identities, tested again and used for a new transaction. The published adapter
archive was not changed. Only the authorized product/backend instances were
restarted; no controller, container or existing writer service was restarted.

The resulting configuration contains no control functions, confirmed actuator
bindings, actuator write mappings, native control transports, scenes,
notification routes or enabled SQL exporter. Backend capability inspection
confirms read-only mode, no control enablement and no registered native expiry
authority. Existing credentials and vendor files are unchanged. Shared provider
cooldown is preserved rather than cleared by installation.

The running installed product completed a bounded observation with successful
existing backend request/reply traffic, no source connection errors, no pending
device commands and no history-storage error. Configured full profiles were read
without modification. Fresh source replay retained original timestamps, passed
metadata checks and kept unavailable physical events and old optional sources
explicitly unavailable or stale.

Checked house policies, effective controller settings, active flows, unrelated
instance configuration, dependencies and service identities/start times remained
unchanged. Raw installation data, source values, paths, configuration, backup,
operator tooling and the explicit transaction-bound rollback remain private and
are excluded from the public repository/package.

This records source-only installation and bounded startup/read verification.
It does not establish a new 24-hour acceptance, physical expiry/App-priority
evidence, exclusive actuator handoff or actual rollback under actuator control.
Those acceptance gates remain open.
