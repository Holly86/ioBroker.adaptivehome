# Adaptive Home

Configurable ioBroker automation for rooms and freely named installations: motion lighting, climate,
air quality, scheduled equipment and continuous minimum service. Start with one function. Add local
learning up to an automatic observe → learn → plan → execute → check effect → rollback cycle.
No language model, notification account, Node-RED or separate web app is required.

**0.1.0-beta.5** adds [read connections and a backend-hosted native transport](docs/connections.md),
seven optional read-only data profiles and SQL telemetry logging. Tested on a real js-controller
with synthetic devices. Physical devices and cloud accounts have not been certified. See [compatibility](docs/compatibility.md).

[Deutsche Anleitung](docs/guide.de.md) · [English guide](docs/guide.en.md) ·
[SDK](docs/integration-sdk.md) · [Verification](docs/verification/scenarios.md) ·
[Releases](https://github.com/Holly86/ioBroker.adaptivehome/releases)

## Install the built beta

Use Node.js 22.19+ or 24, js-controller 7.2.5+ and Admin 8.3.11+.
Tested locally: Node 24.22.1, controller 7.2.5, Admin 8.3.11 on Windows.
Download the release's `.tgz` and `SHA256SUMS.txt`. Verify its checksum, then run in the ioBroker directory:

```sh
npm install ./iobroker.adaptivehome-0.1.0-beta.5.tgz
iobroker upload adaptivehome
iobroker add adaptivehome --enabled
```

Open Adaptive Home in Admin's tab menu. Use the built `.tgz`; the source archive needs a development
build. GitHub beta, npm publication and ioBroker latest/stable inclusion are separate statuses.
This beta does not claim catalog inclusion.

Beta 5 includes the [freshness and policy corrections](docs/policy-parity.md).
Device read-evidence and normalized context sources must actually be connected.
The native heating profile extension is contract-tested; the standard hmip backend
does not provide its full-profile/absolute-expiry transport. Keep unsupported
functions disabled. Beta 5 does not authorize a production handoff.

## Configure

Create rooms/installations, confirm physical device identities, map required read/write/feedback
capabilities, then add functions and operating limits. Discovery offers proposals, never permission
to switch. Remove competing automation writers before activating an output. Validate and activate
the whole draft. Invalid or conflicting revisions leave the previous valid configuration active.

Included synthetic examples: [apartment](examples/apartment.json) with light and climate,
[aquarium](examples/aquarium.json) with independent lighting and essential circulation, and
[air-quality area](examples/air.json). Replace every synthetic path before real use. A pool is not required.

## Learning modes

| Mode | Behavior |
| --- | --- |
| Classic | Configured deterministic rules only |
| Observe | Local training, no learned activation |
| Suggest | Candidate parameters; operator accepts a plan |
| Bounded | Automatic changes to explicitly granted parameter ranges |
| Full | Automatic permitted parameters and rule combinations; effect checks and rollback |

Each function needs an explicit grant, allowed capabilities/blocks/ranges, change budget and data-quality
limits. Hard limits, exclusions, essential service and manual priority continue to apply. Missing
evidence keeps a plan inactive or restores classical control. Pause, resume, cancel and revert
are available per function. Command acceptance, backend feedback, device evidence and useful effect
remain separate facts.

## Integrations and privacy

Profiles use existing ioBroker backends:
[Shelly](https://github.com/iobroker-community-adapters/ioBroker.shelly),
[Homematic CCU](https://github.com/ioBroker/ioBroker.hm-rpc),
[Homematic IP Cloud](https://github.com/iobroker-community-adapters/ioBroker.hmip),
[Hue](https://github.com/iobroker-community-adapters/ioBroker.hue),
[Philips Air](https://github.com/iobroker-community-adapters/ioBroker.philips-air), and optional
[Tradfri](https://github.com/AlCalzone/ioBroker.tradfri),
[Matter](https://github.com/ioBroker/ioBroker.matter) or [Zigbee](https://github.com/ioBroker/ioBroker.zigbee).
Only present, verified capabilities are executable. Additional manufacturers use the declarative SDK
without changing existing policies.

Telegram, Pushover, email and model providers are optional and disabled by default. No telemetry is
sent. Observations remain in the private ioBroker database; history is bounded to seven days/10,000
entries. Provider calls require summary-sharing consent and durable budgets. Support export strips
observations, IDs and recipients. Keep database backups and ordinary configuration exports private.

## Development

```sh
npm ci
npm run build
npm run check
npm test
npm run lint
npm run test:integration
```

[Test reproduction](docs/testing.md) · [Operations/rollback](docs/operations.md) ·
[Release procedure](docs/releasing.md) · [Authoritative AP manifest](docs/implementation/work-packages.json).
Meter readings, power integration and estimates have distinct labels and coverage. No measured
household energy-saving claim is made.

## Changelog

### 0.1.0-beta.5

- Add explicit read evidence, configured read sources and shared-session native heating transport.
- Add cache-only mihome-vacuum, radar2, solarmanpv, openweathermap, nina, harmony and alexa2 profiles.
- Process selected sources independently of actuator functions; show source quality in Admin.
- Add optional bounded SQL export of generated observations/events with persistent uncertainty handling.
- Native backend registration and real absolute-expiry hardware evidence remain deployment prerequisites.


### 0.1.0-beta.4

* Separate device read evidence from event time; support continuous twenty-minute quiet without replaying old movement.
* Add quiet-based manual OFF rearm, manual input/signature handling, departure/welcome/session rules and confirmed compound light activation.
* Restrict command values independently of readable feedback, including OFF-only outputs that are currently ON.
* Preserve correlated own-device feedback across millisecond timestamp jitter so it does not create false manual ownership.
* Add context-aware climate and a finite native-profile SDK contract with explicit dynamic fallback choices and correlated delayed activation/expiry.
* Expose the optional settings in Admin and add anonymized regression tests. Real source connections, native backend transport and hardware acceptance remain separate prerequisites.

### 0.1.0-beta.3

* Separate measured temperatures from thermostat targets; validate raw units before conversion.
* Classify Hue resources from parent metadata, exclude sensor/group controls and quarantine duplicate light aliases.
* Add Shelly Wh/Celsius/gain detection and read-only legacy Air power/percent telemetry.
* Add anonymous discovery regressions and actual controller-view verification; repeat private read-only shadow checks.
* Includes the tested source corrections in the built installable package; earlier release assets remain immutable.

### 0.1.0-beta.2

* Reject overlapping function owners in configuration and at the executor boundary. Combine rules and limits in one function per physical output.
* Beta 1 configurations with overlapping aliases must be corrected before upgrading.

### 0.1.0-beta.1

* Dynamic bilingual Admin, exact capability mapping, revision validation and rollback.
* Independent lighting, climate, air and equipment through one audited executor.
* Manufacturer profiles and SDK; manual priority and persistent command budgets.
* Local worker learning, scoped full automation, device/effect checks and automatic rollback.
* Optional notifications, authenticated controls and bounded model providers.
* Real controller, browser, restart, failure and five-minute quiet-time verification.

### 0.0.1

* Independent TypeScript scaffold and public implementation specification.

## License

MIT. Copyright (c) 2026 Holly86.
