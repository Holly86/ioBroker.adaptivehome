# Compatibility and evidence

These are capability profiles over existing ioBroker adapters, not additional device clients.
Install and authenticate the backend independently. Confirm each physical output and remove
other automation writers before activation. Discovery candidates are disabled until confirmed.
Multi-channel outputs have independent proposed identities. A proposal is not physical proof.

| Profile | Reviewed backend reference | Implemented path | Contract fixtures | Actual backend/device |
| --- | --- | --- | --- | --- |
| Shelly | shelly 12.1.1 | Exact channel switch, percent dimmer, string color, available sensor/power/energy roles | Passed, synthetic two-channel fixture | Pending; no model/generation certified |
| Homematic CCU | hm-rpc 4.2.4 | Boolean STATE, fractional LEVEL → percent, thermostat setpoint/temperature, available contact/battery/online | Passed, synthetic fractional-level fixture | Pending |
| Homematic IP Cloud | hmip 4.1.0 | Group setpoint/temperature/window, activeProfile selection, optional switch/dim states | Passed, synthetic group fixture | Pending |
| Philips Hue | hue 3.17.4 | on, percent level or 0–254 bri, color string, motion, logarithmic lightlevel → lx | Passed, synthetic sensor fixture | Pending bridge and device |
| Philips Air | philips-air 2.4.0 | Exposed power, named fanSpeed/mode, pm25 with explicit units, filter hours | Passed, synthetic named-level fixture | Pending exact model and HTTP/CoAP path |

Read and feedback timestamps use the backend's state update time, never only last-change.
Discovery does not claim the update time proves physical sampling; configure freshness
according to backend/device behavior. A shared ack point supplies backend evidence only.
Choose `device` feedback only for a documented device-originating report. No physical
effect or energy saving is inferred from dispatch acceptance.

Shelly generations and CoIoT/MQTT support remain the responsibility of the installed
[Shelly backend](https://github.com/iobroker-community-adapters/ioBroker.shelly).
Adaptive Home exposes only states actually present with compatible metadata. It does not
open direct REST/MQTT connections or infer a pump's purpose from a relay.

Homematic paths are separate: [CCU backend](https://github.com/ioBroker/ioBroker.hm-rpc)
and [Cloud Access Point backend](https://github.com/iobroker-community-adapters/ioBroker.hmip).
The public Cloud backend exposes setpoint and active profile selection; this product does
not write schedule contents, sensor offsets or unsupported native expiration commands.
Native profile selection uses explicit configured rules and must list known profile values.
A group ack is not confirmation from every thermostat. Bind excluded or independently
controlled members individually; group bindings must declare memberPhysicalIds to prevent
overlapping write paths. No backend file is modified. Cloud commands should be infrequent;
the adapter's durable limits are local operator limits, not a claimed vendor quota.
Missing sources keep the already running native device program; Adaptive Home issues no
global off or blanket profile reset on an outage.

[Hue backend](https://github.com/iobroker-community-adapters/ioBroker.hue): lightlevel
is converted from the Hue logarithmic scale to lx. Already-normalized lux is not converted
again. Discovery keeps exact channel parents; it does not pair differently named sensor
channels by similarity. Confirm physical identity and combine the actual motion/lux paths
manually when the backend exposes separate channel IDs. Aggregate groups/scenes are not
automatically proposed; authorize all memberPhysicalIds before explicit group mapping.

[Philips Air backend](https://github.com/iobroker-community-adapters/ioBroker.philips-air):
select the exact supported model in that backend. This profile maps its exposed named controls,
not raw D-codes. Fan values are ordinal: classic fanSpeed silent=0, 1/2/3, turbo=4,
auto=5, allergenSleep=6; speed-mode profiles use off=0, speed1–5, sleep=6, turbo=7,
medium=8, auto=9. Configure air-rule low/high to actual available values; these are not %.
Unknown names remain invalid. No timer or raw-code control is exposed, including the
CX3550 timer limitation. An unrecognized model can remain read-only. A purifier is not
assumed to provide a thermostat. PM thresholds are operator choices, not health claims.

Hardware check: record model, firmware, transport, backend version, exclusive output,
read/command/feedback paths; observe manual input, successful report, timeout, disconnect,
reconnect and unchanged measurements. Keep raw reports private. An actuator write requires
specific pilot authorization; hardware availability does not imply switching permission.
