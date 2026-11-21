# Beta 10 verification

Version 0.1.0-beta.10 includes passive HmIP state-map configuration, the public SDK helper
and an anonymous importable example. It reads existing manufacturer states without
backend messages, new cloud sessions or fallback polling. Original acknowledged receipt
times, identity/quality checks and unchanged age limits remain required. All aggregate
members must be valid; connection health is not measurement freshness.

Forecasts validate selected point receipts individually. Staged updates, unused points and
window progression no longer invalidate correctly confirmed selected data. Silent rewrites,
individual timestamp rollback and future selected receipts remain rejected. Window movement
does not manufacture a new receipt. Separate controller suites own separate adapter lifetimes.

Release checks are being performed against the frozen installable archive. Publication,
private read-only installation and physical control acceptance are separate results.
No production writer handoff or 24-hour acceptance is implied. npm and catalogue publication
remain separate external steps.
