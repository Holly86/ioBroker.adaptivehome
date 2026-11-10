# Physical expiry and handoff preparation

Preparation on 2026-11-10 for published Beta 6; no new runtime release. This is a
plan and a fresh read-only inventory check, not completed physical acceptance.
The existing vendor files, house rules, effective runtime, active flows and writer
processes were preserved. No actor request, production configuration change,
installation, restart, network interruption or physical test was performed.

The private runbook identifies the specific targets, native profile differences,
first test cohort, required maintenance actions, evidence records, abort conditions
and rollback. Its intervention/case manifest, scoped proof template, original-state
backups and disabled configuration remain ignored. Every physical case is not_run;
all execution/approval flags are false and the proof template has no valid authority.
The released tarball/tag/assets are unchanged.

Commissioning must be separated from routine automation: the Beta 6 native endpoint
already requires physical acceptance before apply. A separately bounded, reviewed
manual commissioning path is still needed to establish initial evidence. No evidence
flag may be fabricated to enter normal control. An official App test may establish
underlying device behavior but cannot by itself certify the adapter transport,
journal, request traffic or restart behavior.

The handoff SDK produces pure guarded proposals. A durable lifecycle coordinator,
proposal reservation/deduplication, current manual-wish transfer and an executable
recovery path still need isolated acceptance before live use. Old-writer scope must
be covered in full; a comfort-room selector does not prove that excluded rooms can
no longer receive writes. Partial permanent takeover requires a separately proven
per-target exclusion in the previous writer. A maintenance trial that pauses a
shared old writer is distinct from such permanent takeover.

The physical sequence covers online expiry, expiry without a new writer, Internet
loss, access-point loss through the deadline and restart, shared room deadlines,
App/local manual precedence, window behavior, original member feedback and traffic
budgets. Global access-point tests affect the whole connected installation. Offline
expiry needs a local device/time witness before reconnecting, not merely a cloud
state received afterwards. Real quiet/manual lighting checks and physical feedback
precede the separate lighting-owner handoff.

Rollback stops the new writer first, confirms actual native expiry/fallback,
preserves newer human wishes, validates profile/manual revisions and only then
resumes the previous owner. Historical time-dependent schedules must not be blindly
replayed. A failed native expiry requires supervised human recovery and blocks
automatic progression; stopping software is not proof of expiry. The private plan
contains the concrete original-state references and future recovery sequence.

Verification in this preparation is limited to read-only production invariants,
exact published-package reference, profile/target/member consistency, backup hashes,
disabled configuration validation and non-executable case/proof records. Existing
Beta 6 software evidence remains in [release verification](beta6-release.md).
No new hardware certification or production handoff is claimed.

The [manufacturer FAQ](https://homematic-ip.com/de/faqs) describes timed party mode
and selected heating profiles. The [Access Point manual](https://homematic-ip.com/sites/default/files/downloads/hmip-hap-um-web_1.pdf)
distinguishes factory/reset procedures from ordinary operation. Neither is proof
of this installation's offline expiry; factory reset is excluded from the plan.

## Software follow-up (2026-11-10)

The bounded manual commissioning executor and executable durable handoff/recovery services are now implemented and isolated-tested in development source. The [implementation evidence](manual-commissioning-coordinator.md) replaces their earlier implementation prerequisite. Scoped deployment, actual legacy-store/provider wiring and physical acceptance remain separate; no existing house component was changed.
