# Beta 10 verification

[Published installable GitHub prerelease](https://github.com/Holly86/ioBroker.adaptivehome/releases/tag/v0.1.0-beta.10),
published 2026-11-21. Immutable runtime/tag source: 17ded80ebc3099a3b3e977a2dbd3b46bdd92034d.
Both [source CI](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/44956292780)
and [tag CI](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/44957259819)
passed all seven Node 22/24 Linux/Windows/macOS jobs. npm publication and ioBroker
latest/stable acceptance remain separate external steps.

Version 0.1.0-beta.10 includes passive HmIP state-map configuration, the public SDK helper
and an anonymous importable example. It reads existing manufacturer states without
backend messages, new cloud sessions or fallback polling. Original acknowledged receipt
times, identity/quality checks and unchanged age limits remain required. All aggregate
members must be valid; connection health is not measurement freshness.

Forecasts validate selected point receipts individually. Staged updates, unused points and
window progression no longer invalidate correctly confirmed selected data. Silent rewrites,
individual timestamp rollback and future selected receipts remain rejected. Window movement
does not manufacture a new receipt. Separate controller suites own separate adapter lifetimes.

Build, typecheck, full lint, 214 TypeScript tests, ten Admin contract tests and 61 package
checks passed. All 20 frozen-archive controller/browser/SQL/quiet-time checks passed on
Node 24.22.1, js-controller 7.2.5 and Admin 8.3.11. All 132 installed runtime/Admin files
matched. Three alternate reference configurations and German/English Admin workflows passed.
SQL 3.0.1 persisted generated data in isolated SQLite. The real quiet interval was 301688 ms.
An interrupted local run was discarded; the complete run used the final frozen archive.

The archive contains 158 files, 375002 packed bytes and 1462781 unpacked bytes. SHA-256:

`433796889a884bd0a3c7c86db7231eb055d4775e7c9685dd02075129de517ad4`

Public-content and archive review found no private installation files. The fresh published
download, checksum and GitHub asset digest match the tested frozen bytes. The downloaded
package passed three further isolated checks: passive HmIP freshness without backend/device
messages, source-only regressions and actual Admin browser workflows. All 132 runtime/Admin
files matched again. Earlier release assets and tags remain unchanged.

The scoped private read/shadow installation and its remaining source limitations are recorded
separately in [read-only installation verification](beta10-readonly-installation.md). These
checks do not accept physical expiry, exclusive writer handoff or unattended production control.
No new 24-hour acceptance was performed. Other SQL dialects and untested hardware remain open.
