# Readiness source and native-host corrections (unreleased)

Source version: 0.1.0-beta.6-dev.0. The published Beta 5 tag/assets are unchanged.
This work improves source readiness; it does not claim a completed production takeover.

Implemented and anonymized-test verified:

- Protected, explicitly declared credential-file references for finite HTTP read endpoints.
  Source documents and exported household configuration do not contain those credentials.
- Shelly status acceptance checks the exact MAC/model through a fixed identity GET first.
- State-map forecast inputs carry selected at/min/max and original contributing receipts.
  Aggregates retain their oldest receipt, reject bad/future evidence, and fail closed on
  missing samples, cadence/coverage gaps or receipt regressions.
- Time-derived case/forecast transitions retain real source proof while using a distinct
  evaluation/event time. Source changes with identical receipt time remain rejected.
- Actual HmIP profile response shapes: profileId metadata, omitted index/name, enabled
  full HEATING_COOLING week, conflicting-identity rejection and normalized profile readback.
- A maintained backend can register finite read/native/capability messages on its existing
  authenticated API. Default read-only mode rejects apply requests before vendor mutation.
  Registration performs no startup REST/authentication and preserves unrelated handlers.

Local gates passed: typecheck, build, full lint, 129 unit/contract tests, 61 package checks,
and 15 actual controller/browser/soak checks. The new backend-host test exchanges real
controller messages and processes the resulting observation with zero device commands.
The exact frozen development package is npm-installed in js-controller 7.2.5; all 102
runtime/Admin files match. Admin 8.3.11 browser checks cover three alternate configurations,
English/German and wide/narrow layouts. The quiet test waits five real minutes. Real
SQL 3.0.1 / SQLite persistence remains verified in the isolated test only.

Frozen artifact: iobroker.adaptivehome-0.1.0-beta.6-dev.0.tgz, 125 files,
265,569 packed bytes and 1,051,609 unpacked bytes. SHA-256:
`07b30dc4e585c3e0c257b16a5f355763350cddcea151597fd21b512ea10cbd6f`.
It is a local development candidate, not a newly published beta release.
Source CI results are recorded separately in the authoritative work-packages ledger.

## Private read-only/shadow evidence

Bounded live reads from the intended controller environment verify fixed Hue/Shelly
GET paths and selected existing ioBroker inputs. Exact source receipts are preserved.
Source replay explicitly disables inaccessible old report-file inputs rather than
pretending they were mounted or inventing replacement booleans. The completed private
configuration remains disabled and contains no copied credentials. Missing/stale values
and cached native-profile evidence are reported separately from a real server read.
Main, HomeRuntime and Executor are not loaded in the private policy preview.

No actuator request, existing configuration write, production install, backend patch,
restart or SQL message was performed. Checked effective configurations, instance
fingerprints, active Node-RED flows and controller container states remained unchanged.
Private identities, observations, topology counts and raw data are not published.

## Remaining deployment gates

Some legacy manual/use/presence/calendar context must still be independently provided
or explicitly transferred before its old writer stops. The installed backend does not
register the new public commands. The SDK integration is implemented and tested but is
not injected into a running foreign process; maintained backend registration and a
planned lifecycle change are separate steps. The installed weekly-profile contract
still has no proven real device/server one-shot absolute expiry. No process timer,
weekly end time or cached successful profile read substitutes for that capability.
Physical feedback, manual-wish handoff, exclusive ownership and rollback remain open.
The current configuration is therefore not approved for takeover.

All seven source CI jobs passed on Node 22/24 across Linux, Windows and macOS:
[actual source CI run](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/42652481987). Source commit: `6cc2a82e2dfc066a53ae28cac35aeb2e2891b2d9`.
The frozen package remains byte-identical after the source commit. The completed
private draft is based on the again-read active policies; no source times, physical
expiry evidence or production permissions were invented to close the remaining gates.
