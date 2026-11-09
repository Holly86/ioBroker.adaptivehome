# Beta 5 release verification

Published GitHub prerelease: `0.1.0-beta.5`, with read-evidence/source connections and
shared-session native transport, seven optional cache-only data profiles and SQL telemetry.
[Release and installable package](https://github.com/Holly86/ioBroker.adaptivehome/releases/tag/v0.1.0-beta.5). Runtime/tag source: a8cdae6a3e85876781f3ec4888af17505cd8d10c.
The [source CI run](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/42634521526) completed all seven Node 22/24 Linux/Windows/macOS jobs successfully.

Package: `iobroker.adaptivehome-0.1.0-beta.5.tgz`, 254,738 packed bytes,
123 files, 1,009,566 unpacked bytes. SHA-256:
`b95ea53fdcc074face97b9686eb2f910e70317cdc7948f06cad97baba8ca9ddc`.

Software verification: typecheck, build and full lint; 116 anonymized unit/contract checks,
61 package checks and 14 actual controller/browser/soak checks. The exact frozen tarball
is npm-installed in an isolated js-controller 7.2.5. All 100 runtime/Admin files match.
Three alternate Admin configurations cover different prefixes/device counts, timezones,
English/German and wide/narrow layouts. The quiet-interval test waits five real minutes.

New profiles: mihome-vacuum, radar2, solarmanpv, openweathermap, nina, harmony and alexa2.
Anonymized checks cover dynamic instance discovery, exact types/units, nulls, missing ack,
stale false, exclusion of commands/secrets, read-only rejection and source-only operation.
Selected data enters observations, local history/learning and explicit supported rule inputs.
No new media/device observation automatically establishes household occupancy.

SQL verification uses the real sql 3.0.1 adapter and an actual isolated SQLite database:
a generated source observation is stored through storeState and read back from ts_string.
Only own telemetry datapoints are used; device command count is zero. Unit contracts cover
bounded offline queues, visible drops, destination changes, reservation persistence and
uncertain acknowledgements across restart. There is no exactly-once/lossless-storage claim.
Other SQL dialects are not separately database-tested. Influx export is not implemented.

Reproduction, in addition to the general testing guide:

```sh
npm install --prefix .local/sql-test-runtime --omit=dev iobroker.sql@3.0.1
```

Set `ADAPTIVEHOME_SQL=1` for the SQL controller test; set `ADAPTIVEHOME_PACKAGE` to the
unchanged frozen tgz for installation byte proof. See [connections and logging](../connections.md).
The package and public tree were also compared against private installation identifiers;
there were zero matches and no private/raw evidence is published.

No physical device certification, production controller handoff, npm publication or ioBroker
catalog acceptance is implied. Native backend registration, real absolute-expiry evidence,
source accessibility/independence and scoped physical feedback/rollback remain deployment gates.

## Published-package recheck and private pilot

The release tgz and checksum were downloaded again. The fresh download, GitHub asset digest,
checksum file and frozen tested artifact match exactly. A further isolated installation ran
the actual source-connection and real SQL/SQLite tests against those published bytes: both passed.
Earlier beta tags/assets remain unchanged. No npm/catalog publication is claimed.

The freshly downloaded package also completed the bounded private read-only/shadow pilot.
Its discovery, normalization, configured read-source replay and finite policy modules were used
without loading main, HomeRuntime or Executor. The SQL exporter was not instantiated.
There were zero actuator/configuration writes and zero SQL/backend messages. Checked effective
settings, instance fingerprints, active Node-RED flows and controller container states were unchanged.
No production adapter was installed, restarted or configured. Raw identifiers and household
observations remain only in ignored local evidence.

A schema-valid disabled private draft includes the seven selected data families and SQL settings.
All actuator functions, native transports, read connections, source observers and SQL export remain
disabled in that saved draft. The production Admin minimum is met following the earlier separately
authorized update. Cached stale/missing data, disabled optional backends, source access/independence,
native registration/absolute expiry and physical handoff/rollback remain open where applicable.
No production control takeover is approved by this evidence.
