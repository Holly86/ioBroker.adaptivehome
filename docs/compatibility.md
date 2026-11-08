# Compatibility and evidence

These are capability profiles over existing ioBroker adapters, not additional device clients.
Install and authenticate the backend independently. Confirm each physical output and remove
other automation writers before activation. Discovery candidates are disabled until confirmed.
Multi-channel outputs have independent proposed identities. A proposal is not physical proof.

| Profile | Reviewed backend reference | Implemented path | Contract fixtures | Actual backend/device |
| --- | --- | --- | --- | --- |
| Shelly | shelly 12.1.1 | Exact channel switch, percent dimmer, string color, available sensor/power/energy roles | Passed, synthetic two-channel fixture | Pending; no model/generation certified |

Read and feedback timestamps use the backend's state update time, never only last-change.
Discovery does not claim the update time proves physical sampling; configure freshness
according to backend/device behavior. A shared ack point supplies backend evidence only.
Choose `device` feedback only for a documented device-originating report. No physical
effect or energy saving is inferred from dispatch acceptance.

Shelly generations and CoIoT/MQTT support remain the responsibility of the installed
[Shelly backend](https://github.com/iobroker-community-adapters/ioBroker.shelly).
Adaptive Home exposes only states actually present with compatible metadata. It does not
open direct REST/MQTT connections or infer a pump's purpose from a relay.

Hardware check: record model, firmware, transport, backend version, exclusive output,
read/command/feedback paths; observe manual input, successful report, timeout, disconnect,
reconnect and unchanged measurements. Keep raw reports private. An actuator write requires
specific pilot authorization; hardware availability does not imply switching permission.
