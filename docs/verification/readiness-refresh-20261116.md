# Readiness refresh – 2026-11-16

The unchanged published Beta 7 was used for a fresh bounded private read-only observation and local pure-policy replay. Product sources, released assets and production controls were preserved.

A disabled private color-temperature signature configuration had labelled raw Hue bridge CT values as Kelvin. It now retains the native Mired unit, with model-reported bounds and matching source/mapping metadata. No CT write capability or fabricated conversion was introduced. The [integration manufacturer's manual, pages 36–37](https://www.ise.de/fileadmin/content/files/produkte/SMART-CONNECT-KNX-Serie/Hue/en/Product_Manual-ise_smart_connect_KNX_Hue_EN.pdf) documents the Hue native-unit distinction. Corrected signatures passed replay through the released source/normalization modules.

All configured metadata audits and required read-only handoff/profile reads passed. Missing or stale optional data remain explicitly unusable; unreachable equipment remains blocked. No production adapter installation, configuration write, restart, actuator request, new cloud session or physical acceptance occurred. Private identities, source snapshots, profile/owner information and preparation remain ignored.

Next gates are concrete maintained lifecycle/original-request/manual-wish/operator provider wiring and isolated acceptance, separately scoped read-only deployment, then on-site native-expiry and whole-writer-scope handoff/rollback acceptance. Routine control and manual commissioning are not enabled. The historical [Beta 7 release evidence](beta7-release.md) and its artifact remain unchanged.
