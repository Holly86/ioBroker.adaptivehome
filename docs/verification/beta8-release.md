# Beta 8 release verification

[Published installable GitHub prerelease](https://github.com/Holly86/ioBroker.adaptivehome/releases/tag/v0.1.0-beta.8), version 0.1.0-beta.8, published 2026-11-19. Runtime/tag source: 7f81e0b0fec3e2b9437b89ef2e71073171080268. [Source CI](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/44481077466) passed all seven Node 22/24 Linux/Windows/macOS jobs. npm publication and ioBroker latest/stable acceptance remain separate external steps.

The built tgz contains 149 files, 339083 packed bytes and 1354427 unpacked bytes. SHA-256:

`b791be9c019331c9440317f1e1ae3823ffcabecaf6c5cb40cf884ffc26209805`

Beta 8 includes original-receipt freshness for trusted time-derived projections, unchanged missing-value history deduplication, change-only history persistence, textual NINA severity, polling-aware new-discovery defaults and sanitized, paced backend read diagnostics. Explicit physical-event proof remains strict. Saved mappings are not silently migrated. The public archive excludes private configurations, context-reader deployments and installation-specific backend hooks.

Build, typecheck, full lint, 191 anonymized unit/contract tests and 61 package checks passed. All 19 exact-frozen-package controller/Admin/browser/SQL/quiet-time tests passed locally with Node 24.22.1, js-controller 7.2.5 and Admin 8.3.11. The installed archive hash and all 126 installed runtime/Admin files match. Three alternate configurations, English/German, keyboard and 1280/390 layouts passed without browser page errors. The actual five-minute quiet interval was 301020 ms. SQL 3.0.1 persisted generated observations and read them from an isolated SQLite database. These tests use synthetic devices/providers; other SQL dialects and physical hardware are not certified.

After publication, the tgz and checksum were freshly downloaded. Frozen bytes, public download, SHA256SUMS.txt and GitHub asset digests agree exactly. The downloaded package was installed again in a fresh local test controller and passed six additional checks: immediate and deliberately slow read-only HmIP backend recovery, source-only derived freshness/textual severity/missing values, bounded manual commissioning, executable synthetic process handoff/rollback and real SQL/SQLite persistence. All 126 installed runtime/Admin files matched again. Earlier tags, releases and assets were not replaced or modified.

## Timeout investigation

Two deliberately failing anonymous negative controls used the prior correction candidate and a valid 14-second existing-session API response. The old 12-second recovery assertion was shorter than the maintained backend's allowed 15-second API budget. Even a 25-second assertion failed with the old five-second consumer deadline: callers timed out before the valid reply arrived; a short cached reply could expire before the next paced retry. The controlled reproduction demonstrates that the runtime deadline also needed correction.

Beta 8 gives backend read/message delivery 20 seconds and retains one pending read per connection. Read refresh runs in the background; HTTP/file deadlines remain unchanged. Both the full run and fresh published-package installation pass immediate and 14-second responses, preserve the provider's minimum wait, require a valid recovered observation and send no actuator commands in the read-only scenarios. Teardown suppresses late fake replies.

The earlier one-off failure had no timing trace. These controlled experiments establish a real mismatch and its correction; they cannot prove that the same latency caused that particular historical run. No physical provider was contacted for this investigation, and these short tests do not establish long-term live stability.

## Installation boundary

This release task performed no production installation, private live pilot, actuator change, production configuration write, production SQL message or restart of an existing service. Test-created local controller processes were isolated on the development PC. The prepared private context reader and read-only backend hook remain uninstalled. Real source availability, a new live observation period, physical native expiry/App priority and actual exclusive writer handoff/rollback remain separate acceptance gates. This release does not establish readiness for control takeover.
