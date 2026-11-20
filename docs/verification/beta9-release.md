# Beta 9 verification

[Published installable GitHub prerelease](https://github.com/Holly86/ioBroker.adaptivehome/releases/tag/v0.1.0-beta.9),
published 2026-11-20. Runtime/tag source: 700a7123084373ccbdfcf1438811d7aff76a2653.
[Source CI](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/44793617756)
passed all seven Node 22/24 Linux/Windows/macOS jobs. npm publication and ioBroker
latest/stable acceptance remain separate external steps.

Version 0.1.0-beta.9 adds guided setup for existing manufacturer adapters, editable names,
rooms and timezone, typed source/device dropdowns, disabled everyday function templates,
optional SQL fields, validated advanced JSON and bundled English/German help. Simple forms
preserve advanced configuration; saved functions require a separate reviewed activation.

Backend receipt projection waits once when an original receipt is exactly one millisecond
ahead at message delivery. It then applies the original strict timestamp checks. It neither
rewrites receipt times nor accepts a timestamp that remains in the future. Anonymous tests
cover eligibility, a stopped clock, larger future timestamps and shared-session cache reads
that retain their original receipt until an actual refresh.

Build, typecheck, full lint, 197 TypeScript tests, ten guided Admin contract tests and 61
package checks passed. All 19 frozen-archive controller/browser/SQL/quiet-time checks passed
with Node 24.22.1, js-controller 7.2.5 and Admin 8.3.11. All 130 installed runtime/Admin files
matched. Three alternate configurations, English/German, keyboard and 1280/390 layouts
passed without browser page errors. The guided draft additionally preserved invalid/stale
JSON edits and advanced settings, selected SQL and saved a disabled function. SQL 3.0.1
persisted generated observations in isolated SQLite. The real quiet interval was 301946 ms.

The archive contains 155 files, 365564 packed bytes and 1429827 unpacked bytes. SHA-256:

`a286d8c93d144edec3c7c8b5f08862d20b0a61f393ee08a2b49e720d310639ff`

Public-content and archive checks found no private installation files or identifiers.
The fresh published download, checksum and GitHub asset digest match the frozen bytes.
All earlier release/asset metadata and tags remain unchanged. The downloaded package
passed seven additional checks after a fresh isolated installation: fast and deliberately
slow HmIP read recovery, source-only freshness/severity/missing data, bounded commissioning,
executable synthetic handoff/rollback, real SQL/SQLite and the actual Admin browser workflows.
All 130 installed runtime/Admin files matched again. No physical acceptance is implied by
these synthetic controller results. Other SQL dialects remain unverified.

The initial full run passed 17 checks and failed two: the separate local Admin fixture was
incomplete, and immediate synthetic backend recovery timed out despite successful replies.
Both immediate and deliberately slow recovery passed a focused repeat before the receipt
boundary correction. The historical timeout has no consumer clock trace, so its exact cause
is not proven by that repeat or by the new deterministic boundary regression.

The first published-package repeat revealed that the Windows test reset traversed links
to separately installed Admin/SQL fixtures. The test harness now removes only its known
fixture links before resetting its own temporary controller directory; fixture files remain
intact across repeated runs. A further zero-delay synthetic reply timed out intermittently.
The message fixture now models 25 ms of queued delivery while retaining the existing API
and recovery deadlines, the rate-limit minimum and the valid-observation assertion. Strict
future-clock cases remain deterministic unit checks. A diagnostic repeat with receipt tracing
passed; it does not prove the cause of the earlier untraced timeout. The final seven-check
downloaded-package run passed with queued delivery. These test-only changes do not alter
the published archive or its immutable tag. Live stability remains separately assessed.

Private context-reader code retries bounded overlapping file generations and evaluates
freshness after the reads while retaining original timestamps. The private backend hook
uses reviewed file hashes and a bounded shared-session cache; provider cooldowns remain in
force. These installation files and private configurations are excluded from the public
package. Their isolated tests, live installation and read-only observation are separate
from the public package checks and from physical control acceptance.

No physical expiry, App priority or exclusive writer handoff has been accepted by these
software checks. Production control takeover and a new 24-hour stability acceptance remain
separate gates. GitHub prerelease, npm publication and ioBroker catalogue acceptance are
reported separately.

The subsequent private installation and bounded live observation are recorded separately in
[Beta 9 read-only installation verification](beta9-readonly-installation.md). They passed within
their limited scope; overall optional-source compatibility and physical control acceptance remain open.

The later test-only harness corrections also passed all seven
[cross-platform jobs](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/44796989661).
