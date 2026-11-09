# Read connections and shared-session heating transport

Development source: 0.1.0-beta.5-dev.0 (2026-11-09). This is not a published Beta 5.
Published Beta 4, its tag and its checksum remain unchanged.

The implementation connects finite source declarations to the actual runtime read/audit ports:
bounded JSON files, acknowledged JSON states, exact state joins, fixed Hue/Shelly GET reads and
an existing-session HmIP reader. Successful reads and physical events have separate timestamps.
Missing/future/regressing evidence, partial membership, unreachable resources and source-session
changes cannot silently become valid absence or motion. Optional source work is asynchronous
and does not suspend independent functions. Native endpoint settings/credentials are protected
separately from exported product configuration. Admin provides forms for the additive fields.

`HmipSessionSource` reads through an already authenticated client, shares bounded receipts,
forces uncached preflight reads and keeps full profile-content age separate from device status.
`HmipNativeEndpoint` transfers finite full profiles with preserved identity/name, actual Executor
dispatch deadlines, durable reservation/replay/uncertainty gates and separate member confirmation.
App manual/party/boost modes remain authoritative. Profile replacement is checked against the
persisted pre-write identity/content baseline. No installed third-party adapter is patched.

The standard backend does not register this new public extension automatically. A verified real
device/server absolute-expiry provider is still required: weekly recurrence and process timers
are not absolute one-shot expiry. Without it, the endpoint rejects a transfer before vendor writes.
The positive expiry path uses a synthetic independent native facility, including controller absence
and the following week's non-recurrence; it is not a physical manufacturer capability claim.

Build/type/lint, 103 unit/contract tests and 61 package checks passed. Anonymous regressions cover
strict source completeness, bounded routes/files, unchanged events with fresh read receipts,
source changes, delayed member reports, dispatch expiry during backend preparation, full-profile
readback/identity replacement and restart uncertainty. The real js-controller source-connection
case exercises projection, a synthetic lighting command and its declared backend-only feedback;
it deliberately does not upgrade an acknowledgement into device certification.

Final frozen development-package controller/browser/soak verification and cross-platform CI are
being completed. Their final evidence is recorded here and in the sole implementation ledger.
Private configuration, operational maintenance, source snapshots and installation acceptance
remain excluded from the public repository. A disabled draft is not a live handoff.

See [connection and backend contracts](../connections.md) for deployment and remaining gates.
