# Beta 4 release verification

[0.1.0-beta.4](https://github.com/Holly86/ioBroker.adaptivehome/releases/tag/v0.1.0-beta.4)
is a published GitHub prerelease with an installable built package and SHA256SUMS.txt.
Runtime/tag source: `577a660adb1f073e3e0d68c96e100635ddd0e0af`.

Artifact: `iobroker.adaptivehome-0.1.0-beta.4.tgz`, 199,965 packed bytes,
106 reviewed files, 791,724 unpacked bytes. SHA-256:
`26d6f51ae85757f8a8c9477e456461f70573d7ab95dfa2f883511b79e6955269`.
The fresh public download, checksum asset, GitHub asset digest and isolated-test archive match.
Earlier tags and assets were not replaced. No npm or ioBroker catalog publication is claimed.

## Verified software

Beta 4 ships the independent read-evidence freshness model, continuous lighting quiet interval,
manual rearming, configurable house/climate rules and finite native-program extension described
in [policy parity](../policy-parity.md). Anonymous regressions also cover own-command feedback
with bounded timestamp jitter and waiting real time for a report at most 20 ms ahead of the
initial read clock. Timestamps are not rewritten, and a still-future or invalid report stays unknown
or invalid. Rejected unpublished candidates exposed these timing problems before release.

| Check | Result |
| --- | --- |
| Typecheck, lint and build | Passed |
| Unit/contract tests | 85 passed |
| Package checks | 61 passed |
| Isolated controller/browser/soak tests | 12 passed |
| Installed executable build/Admin files | 84 byte-identical |
| Actual quiet interval before confirmed synthetic off | 301,578 ms |
| Alternate Admin configurations | 3 passed |
| Cross-platform/Node CI jobs | 7 passed |

The exact frozen archive was npm-installed in isolated js-controller 7.2.5/Admin 8.3.11.
The three alternate configurations cover America/New_York, Asia/Tokyo and Australia/Perth,
different device/function counts and Shelly, Hue, Homematic CCU and Philips Air profiles.
English/German, keyboard use and 1280/390 layouts passed without browser page errors.
[Source CI](https://github.com/Holly86/ioBroker.adaptivehome/actions/runs/42610700553)
passed on Linux, Windows and macOS with Node 22/24.

The fixture emits physical reports independently of the controller cache; its optional heartbeat
is confined to the synthetic soak. These results do not certify physical models, accounts or
household effects. The archive and public files were reviewed for private identifiers, secrets,
raw logs and installation configuration; no installation identifiers were found.

## Private read-only repeat and remaining gates

The freshly downloaded published package was extracted locally without installing or starting
the adapter in the existing house installation. Discovery, normalization, schema validation and
pure policy functions were used; main, HomeRuntime and Executor were not loaded. The observer
read existing object/state caches and scoped configuration/status context. It had no actuator
write port, device/cloud client or model/notification session. Raw data and the disabled migration
draft remain in ignored private storage.

The bounded three-minute observation completed with zero device or configuration writes.
Before/after comparisons of effective configuration, active Node-RED flows, instance settings
and existing controller containers were unchanged. The local hypothetical policy preview does
not grant automatic ownership or enable the saved draft.

Control takeover remains pending: the installed Admin version must meet the minimum; real
device-read evidence producers and normalized shared sources must be connected and verified;
backend enrollment, unavailable resources and physical feedback require acceptance. The standard
HmIP backend still lacks verified full native-profile/absolute-expiry transport. The extension
contract is software-tested, not a connected production transport. Exclusive writer handoff and
rollback acceptance were not performed. No existing house controller, actuator or backend was
changed by release testing or the read-only pilot.
