# Dated heating leases and guarded handoff preparation

Source: `26a150358f2ea116da2c8ddf23f4407893a42bb6`, unreleased development
version `0.1.0-beta.6-dev.1`. Published Beta 5 is unchanged.

The optional `timed-lease` strategy sends an immediate, dated native party command
against an already commissioned constant fallback profile. It does not upload a
recurring comfort schedule. Plans expire within fifteen minutes, use a five-minute
deadline grid and stop before the next policy boundary. A room joining an existing
owned lease uses exactly its shared deadline. Earlier incompatible cutoffs are
rejected. App changes, manual/absence modes, unknown ownership, changed profiles,
ambiguous sends, stale feedback and timezone changes block further automation.
The weekly-profile strategy retains its separate absolute-expiry-provider gate.

Control requires explicit target authority, a durable pre-send journal and scoped,
time-limited physical acceptance bound to the home, profile fingerprint, member set
and timezone. Successful server acceptance is distinct from device feedback:
configuration-pending flags and original group/member status timestamps must prove
the dispatched target. A restart does not adopt or replay an active party lease.
An unmodified native constant fallback supplies the intended return state; neither
an adapter timer nor receipt of an API response proves physical expiry.

The handoff SDK is a pure proposal/state-machine contract, without lifecycle or
actuator ports. It checks the package/configuration fingerprints, fresh observation,
complete physical scope, writer exclusivity, profile/manual revisions and physical
acceptance before proposing a transition. A future coordinator must durably reserve
and deduplicate proposal IDs before acting, positively observe the old writer stopped
before starting the new writer, and recheck all gates. No coordinator was installed.
Rollback first stops the new writer, waits for observed native expiry and fresh
fallback feedback, then permits guarded profile restoration. New manual wishes
require explicit review and are preserved before resuming the previous owner.
Expired activation plans can be cleaned up but cannot reactivate a writer.

Anonymous regressions cover native expiry without an adapter, absence of next-week
comfort recurrence, shared room deadlines, App precedence, profile/member/timezone
acceptance, original device feedback timestamps, ambiguous sends and restart,
read-only rejection, Executor-to-backend dispatch, exclusive writer transitions,
changed manual wishes and rollback after native expiry. Software simulation does
not establish firmware, cloud or offline behavior on physical equipment.

The frozen installable development archive has SHA-256
`7e977373d526c940815ebb0786a32715fc1675cd6b3286d8a80f641ca3432eab`.
Build, typecheck, full lint, 153 unit/contract tests and 61 package checks passed.
All 15 exact-package controller checks passed, including actual SQL/SQLite,
the five-minute quiet interval and Admin variants in both languages and layouts.
All 110 installed runtime/Admin files matched the frozen archive. All seven
source CI jobs passed on Node 22/24 across Linux, Windows and macOS.
The authoritative ledger records these completed checks.
The private repeat reads existing sources and full configured server profiles, then
evaluates the exact frozen product modules without Main/HomeRuntime/Executor or a
write port. Disabled configuration, constant-profile previews, scoped writer plans
and original-state backups remain private. Existing house policy, runtime, flows,
vendor files and controller processes were preserved. No actuator command,
configuration update, restart or production SQL message was issued in this task.

Physical commissioning remains open. Historical installation acceptance booleans
are not substituted for evidence bound to this strategy and its profile/member
scope. The new control transport was not deployed; the installed host remains
read-only. Actual native expiry, Internet/access-point failure, shared deadline,
App priority, window behavior, cloud traffic, device feedback and physical
handoff/rollback require separately scoped acceptance before enabling control.
Private identities, topology, raw observations and device values are not published.

Source CI: [Node 22/24 platform checks](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/42678889167).
The general native party-mode return semantics are documented in the
[manufacturer manual](https://homematic-ip.com/sites/default/files/downloads/Homematic_IP-Anwenderhandbuch.pdf);
that manual is not proof of this backend endpoint or installation's offline expiry.
