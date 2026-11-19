# Beta 8 release verification

Release candidate: 0.1.0-beta.8. Publication and final verification are in progress;
the authoritative completed results are recorded in the implementation ledger.

This candidate includes original-receipt freshness for time-derived projections,
missing-value history deduplication and change-only history persistence, textual
NINA severity, polling-aware discovery defaults and sanitized paced backend reads.
Private installation configurations, context-reader deployments and backend hooks
are excluded from the public archive.

The initial isolated recovery timeout was investigated with an anonymous delayed
existing-session API. A valid 14-second read reproduced the failure with the old
five-second consumer deadline, even with a 25-second recovery assertion: completed
responses could arrive after their callers timed out, then expire from a short
cache before the next paced retry. The former 12-second assertion was also shorter
than the backend's allowed 15-second API read. Beta 8 allows 20 seconds for backend
read/message delivery, keeps one pending read per connection, and tests recovery
with both immediate and 14-second API replies. Other functions continue while the
read refresh runs in the background. No device/provider call was used in this
investigation.

The earlier one-off failure did not record a timing trace. The controlled
reproduction establishes a real budget mismatch and its correction; it does not
prove that the same latency caused that particular historical run.

Build, typecheck, lint, 191 anonymous unit/contract checks and 61 package checks
passed locally. Exact-package controller, browser, SQL/SQLite, quiet-time and
cross-platform CI gates remain in progress. No production installation, restart,
actuator change, real native expiry test or writer takeover is performed by this
release task. npm publication and ioBroker latest/stable acceptance remain
separate steps.
