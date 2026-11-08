# Verification reproduction

```sh
npm ci
npm run build
npm run check
npm run lint
npm test
npm run test:integration
```

Unit tests use explicit synthetic clocks/ports. Integration tests use @iobroker/testing 6.3.1 and a
real pinned js-controller 7.2.5, real object/state APIs and a separate device emulator responding to
ack=false commands. This proves controller integration, not physical device effectiveness. The
controller is installed in a dedicated temporary test directory. No existing home server is used.

Optional extended checks (PowerShell):

```powershell
$env:ADAPTIVEHOME_SOAK='1'
$env:ADAPTIVEHOME_BROWSER='1'
npm run test:integration
```

Browser tests need Admin 8.3.11 installed under `.local/admin-runtime` and Playwright Edge on Windows
(or a configured ADAPTIVEHOME_BROWSER_CHANNEL). Install Admin with
`npm install --prefix .local/admin-runtime --omit=dev iobroker.admin@8.3.11`.
The helper binds an isolated unauthenticated synthetic Admin to loopback port 18081 only; it is not
a production configuration. Tests use the actual Admin HTTP/socket interface, imports/forms/keyboard,
English/German and 1280/390-pixel layouts. Raw screenshots/logs remain ignored under `.local/evidence`.
The soak uses five actual minutes, not a time jump. An immediate write is not treated as confirmed
feedback; the test waits for the later report.

For frozen package proof, copy the release tarball outside the root then set ADAPTIVEHOME_PACKAGE
to its absolute path. @iobroker/testing creates and npm-installs its package; the proof hook compares
that tarball byte-for-byte with the frozen artifact and all installed build/Admin files. Use an
unchanged source/package content, because a different pack correctly fails this comparison.
Set ADAPTIVEHOME_VARIANTS=1 for the additional timezone/device-count/backend-prefix variants.

See [scenario matrix](verification/scenarios.md), the per-AP evidence summaries and compatibility
matrix. Original planning acceptance criteria remain unchanged. No raw private logs are public evidence.
