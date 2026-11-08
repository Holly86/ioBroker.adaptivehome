## Post-beta-2 discovery correction (2026-11-08)

Complete-leaf temperature matching separates measurements from setpoints. Resource-aware Hue discovery
uses parent metadata from real object views, excludes aggregate/sensor controls and quarantines duplicate
light aliases. Shelly Wh/Celsius/gain support and exact source-unit matching are covered by anonymous
fixtures; legacy Air cx power/percent feedback stays read-only. API v1 gains optional parent context and
declarative sourceUnit without requiring executable extensions.

Verification: typecheck/build/lint, 60 unit/contract tests, 61 package checks and 9 real js-controller 7.2.5
integration tests passed, including discovery through actual channel/device/state views and no fixture
actuator writes during discovery. The initial full-suite run hit a synthetic sample-clock race and took
the protective learning-data rollback; after explicitly simulating pre-transport measurement times in
that outcome test, the full suite passed. Production future-time/quality guards were unchanged.

This source correction is separate from the immutable beta-2 release artifact. No new physical-device
certification, software upgrade or actuator handoff is implied. Private live evidence remains ignored.

The bounded private read-only/shadow repeat completed with the corrected discovery/normalization/policy
functions. Configuration fingerprints and checked instance flags remained unchanged, with no device
writes, installations, restarts or new persistent services. Same-inventory replay against beta 2 and
the corrected source removed the reproduced setpoint/sensor-enable/aggregate misclassifications.
Actual cache freshness, ambiguous aliases, disabled/model-conflicting sources and minimum platform
versions remain deployment gates. Private IDs, counts, versions, raw data and report paths are not
part of this public evidence. No existing home configuration was imported or activated.

The source corrections above are now included in the built 0.1.0-beta.3 release. Exact frozen-package,
Admin/variant/soak, cross-platform CI and public download verification passed; see [AP-25](AP-25.md).
The earlier beta-2 artifact remains unchanged.
