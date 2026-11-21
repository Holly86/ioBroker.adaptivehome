# Passive HmIP reads and forecast-history correction

Implemented in development after the published Beta 9; no new release was published.

`hmipPassiveConnection` compiles selected existing manufacturer states into the
established state-map reader. The SDK adds strict configuration, exact instance
scoping, typed values, literal identity/readiness guards, explicit conversions and
complete aggregates. It has no backend-message, REST, login or file fallback path.
The original acknowledged state's receipt/change times remain distinct. A connection
heartbeat and repeated local reads cannot renew a measurement. Missing or old fields
remain unknown independently. An active profile identifier is not a complete schedule
or native expiry/membership acceptance.

The anonymous source-only example is importable through the existing Admin editor;
the SDK, connection contract and German setup documentation describe how to select
states and retire an older REST connection. The generated schema uses existing Beta-9
features, so compatible installations can activate it live without replacing code.

Forecast history now uses selected inputs and per-field receipt progression instead
of the changing set of all configured forecast points. Receipt-only updates, staged
valid updates and clock-driven window changes preserve original evidence. Every
contributing receipt is checked, including future receipts hidden by an older minimum.
Silent changes or regressions are rejected even when the median stays unchanged.
Trustworthy unused points are remembered without blocking the selected result; silent
rewrites are not laundered when the window subsequently selects them.

## Verification

- Build, type checking and lint passed.
- 214 anonymous product unit tests passed, including passive reads over a simulated
  day, expiry, unchanged confirmed reports, missing/bad/future/offline inputs,
  instance/path restrictions, complete valve aggregates, importable example and
  persistent 40-point/24-point forecast regressions.
- Ten Admin checks and 61 package checks passed. No dependencies changed.
- One additional real js-controller 7.2.5 integration test passed in a fresh local
  installation: acknowledged HmIP fixture states became valid, expired, and recovered
  after unchanged confirmation, with zero backend requests or device commands.
  A separately owned earlier test fixture was preserved; its guard prevented reuse.

The private source-only installation activated only the compatible passive source
configuration. The older REST source was replaced; installed adapter/manufacturer
files and house rules were not updated, and no existing service was restarted.
The generated projection matched the unchanged published Beta-9 state-map reader
against existing captured state data. Selected metadata and unit checks passed;
the existing hook counters did not advance. Raw data and configuration remain private.
Some existing reports remain too old for their unchanged freshness limits; this is
not concealed by the passive connection and is not a full hardware acceptance.

The running published package has **not** loaded the new forecast correction or SDK
export: no production binary upgrade/restart was performed. Those changes require a
later tested software update. No new 24-hour, physical-expiry or actuator-handoff
acceptance is claimed. The earlier failed long-term acceptance remains unchanged.
