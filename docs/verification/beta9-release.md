# Beta 9 verification

Version 0.1.0-beta.9 adds guided setup for existing manufacturer adapters, editable names,
rooms and timezone, typed source/device dropdowns, disabled everyday function templates,
optional SQL fields, validated advanced JSON and bundled English/German help. Simple forms
preserve advanced configuration; saved functions require a separate reviewed activation.

Backend receipt projection waits once when an original receipt is exactly one millisecond
ahead at message delivery. It then applies the original strict timestamp checks. It neither
rewrites receipt times nor accepts a timestamp that remains in the future. Anonymous tests
cover eligibility, a stopped clock, larger future timestamps and shared-session cache reads
that retain their original receipt until an actual refresh.

Build, full lint, 197 TypeScript tests, ten guided Admin contract tests and 61 package checks
passed. The release candidate is installed from its frozen archive in an isolated controller;
full controller/browser/SQL/quiet-time verification is in progress. Release publication and
fresh downloaded-package checks will be recorded here only after completion.

The initial full run passed 17 checks and failed two: the separate local Admin fixture was
incomplete, and immediate synthetic backend recovery timed out despite successful replies.
Both immediate and deliberately slow recovery passed a focused repeat before the receipt
boundary correction. The historical timeout has no consumer clock trace, so its exact cause
is not proven by that repeat or by the new deterministic boundary regression.

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
