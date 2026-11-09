# Independent context and read-only heating host

Source: `ff1857fdeb97354d3ddb964a498f558a54553a0d`, development version
0.1.0-beta.6-dev.0. The published Beta 5 remains unchanged.

The SDK now supplies independent, pure projections for persistent operator requests,
light/motion usage, RGB feedback, calendar availability and receipt-based household
presence. Calendar rules are declarative and preserve the original independent fetch
receipt across clock-derived transitions. Changed content with an identical receipt,
expired coverage and malformed input remain rejected. Presence keeps event-time
corroboration for every room even when an earlier room is already active. Neither a
process heartbeat nor a repeated file read supplies missing device scan proof.

The maintained-host API adds allowlisted, enabled-target full-profile inspection through
adaptivehomeProfileRead. A separate frozen read-only facade permits only
home/getCurrentState and group/heating/getProfile, with strict failure propagation.
No new authentication client, native mutation, expiry claim or physical acceptance is
created by registration or inspection. Existing backend handlers remain intact.

Local checks passed: build, typecheck, complete lint, 138 unit/contract tests and 61
package checks. Anonymized regressions cover source loss, absence confirmation/reset,
same-day calendar groups, exclusive event ends, original receipt times, concurrent room
corroboration, distinct percentage/fraction valve sources, profile reads without control
authority and direct rejection of mutation endpoints. Installation-specific anonymous
checks additionally cover existing-handler preservation, actual scan completion versus
probe failure, backend-version mismatch and full RGBW signature parity.

The frozen development archive has SHA-256
`7b74797bb370a9c5bc3502064d93c3a424297a6e119987caaf466e9c1fd86b67`.
All 106 installed build/Admin files were compared against that archive. All 15 isolated
checks passed in js-controller 7.2.5/Admin 8.3.11, including the actual five-minute quiet
interval, three alternate Admin configurations, both UI languages, narrow/wide layouts,
read-command registration and real SQL/SQLite persistence. This is an installable local
development candidate, not a newly published beta or npm release.

In a separately authorized private deployment, an operator-owned, version-pinned hook
registered the read-only host on the existing authenticated backend and added actual
per-device scanner receipts. Scoped backend restarts were authorized. Vendor files and
native access configuration were preserved. The independent observer reads original
operator/calendar stores and identity-checked device feedback; original filesystem
mounts are read-only, with only its private output writable. Legacy reports are used
for comparison, never as target-source input. A scoped rollback is prepared.

The final bounded private shadow repeat passed configuration/metadata validation and
read all previously missing context. Configured full profiles were validated with their
original proof times; a separate closing pass performed fresh actual server profile
requests after the cache interval. The final producer's context module matches the
frozen package. Main/HomeRuntime/Executor was not loaded in shadow evaluation, no SQL
exporter was instantiated, and no device write port existed. No new actuator request,
authentication client, writer handoff or control instance was created. During the final
pilot no configuration write or backend restart occurred. Checked house policies,
effective runtime, active flows and existing controller containers were unchanged.

Private identities, values, topology, raw evidence and configuration remain ignored.
Positive live presence was observed; negative and failure paths have anonymized software
evidence rather than a claim of physical absence testing. Remaining takeover gates are
real device/server absolute expiry for new heating programs and separate physical
feedback, manual-wish/ownership handoff and rollback acceptance. Unreachable or stale
optional devices remain unknown; no actuator handoff is implied by successful reads.

Source CI: [Node 22/24 platform checks](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/42668381006).

All seven source CI jobs passed across Node 22/24 on Linux, Windows and macOS.
