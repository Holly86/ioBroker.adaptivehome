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

The final frozen development package passed **13 controller/browser/soak checks** in isolated
js-controller 7.2.5/Admin 8.3.11. All **96** installed build/Admin files matched. The actual
continuous quiet interval was **301,285 ms** before confirmed synthetic OFF. Three alternate
timezone/device/backend configurations, English/German, keyboard and 1280/390 layouts passed
without page errors, including imported/edited source and backend fields.
[All seven Node/platform CI jobs passed](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/42623548818)
for runtime source `3676191e44ee307fc483419ea771a432a31037dd`.
Development archive SHA-256: `9a5b988c3235cd96291671e6e85060d9b818dd6fcfd6c6955ebf9a8aead4aecf`
(119 files, 957,742 unpacked bytes). This archive was tested locally and was not published
as a new beta release. Public files and archive passed the installation-identifier/secret review.

Private configuration, operational maintenance, source snapshots and installation acceptance
remain excluded from the public repository. A disabled draft is not a live handoff.

See [connection and backend contracts](../connections.md) for deployment and remaining gates.
