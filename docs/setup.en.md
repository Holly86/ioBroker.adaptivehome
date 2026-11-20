# Setup with forms

This guide describes **development after Beta 8**, not the already published Beta-8
package. Adaptive Home connects capabilities supplied by existing ioBroker adapters.
Those adapters retain authentication and device communication. Adaptive Home adds
device selection, cross-manufacturer rules, limits and explanations; no second
manufacturer account is created.

## Getting started

Configure the devices in their manufacturer adapters first. Start Adaptive Home,
open its Admin tab, choose the instance and language, then select **Guided setup**.
A fresh, empty configuration opens there automatically. The ordinary instance
settings contain optional advanced connections, not the everyday setup workflow.

### 1. Rooms and installations

Enter an area name, choose Room or Installation and the time zone for schedules.
Add the area to the draft. Internal identifiers are generated; existing areas are
preserved. The selected time zone governs weekly schedules and daylight saving.

### 2. Existing devices

1. Select **Load installed adapters**. The list contains installed instances matching
   registered manufacturer/source profiles and optional SQL instances. Only safe
   instance summaries are returned; native credentials are not included.
2. Choose the concrete manufacturer/source instance and find its devices. Discovery
   reads existing object descriptions in that instance. It does not start an adapter,
   log in, test an actuator or take over a house rule.
3. Select a candidate and give it a readable device name.
4. Choose Read data only or Prepare a controllable device, then add it to the draft.

Read data only removes write mappings from the imported copy and does not grant
control. Preparing control requires an explicitly reviewed physical identity,
feedback and sole control responsibility. It still creates no enabled function.
Overlapping known device/group identities cannot be imported twice. Edit existing
mappings in Devices & areas rather than silently replacing them.

The adapter's enabled setting does not prove fresh data or a working connection.
A stopped adapter may still have cached objects. Discovery is a proposal, not a
hardware test. Check models and backend variants in the
[compatibility matrix](compatibility.md). Expand Source data points and capabilities
to inspect technical mappings.

The registry supplies supported Shelly, Homematic/CCU, HmIP, Hue, Philips Air and IKEA
variants. Optional read-only context profiles include mihome-vacuum, radar2,
solarmanpv, openweathermap, nina, harmony and alexa2. Additional trusted profiles
extend the list without manufacturer-specific rule pages. Device visibility is not
verified household occupancy; media feedback is not a voice-control grant.
Default discovery age windows are 20 minutes for NINA, two hours for weather,
ten minutes for PV and five minutes for other context profiles. They do not
guarantee actual device polling.

### 3. Everyday functions

First add sensors and a prepared controllable output. Select a name, area, template,
output and inputs. The lists filter capabilities and types.

| Template | Inputs/output | Everyday fields |
| --- | --- | --- |
| Light following motion | Boolean switch, motion, illuminance | Continuous quiet hold in minutes; switch-on threshold in lux. |
| Room temperature | Ordinary writable setpoint, measured temperature, optional window contact | Comfort and setback temperatures in °C within device limits. |
| Fan following air quality | Numeric percent fan and air-quality measurement | Sensor-unit threshold and low/high output percentages. Named fan modes require advanced mapping. |
| Scheduled socket or light | Boolean switch | Weekdays, start/end in the selected time zone; OFF outside. Overnight windows begin on the selected weekday. |

New functions are **disabled**, use classic rules and have no learning permission.
Review inputs, feedback, operating limits, manual priority and sole ownership under
Functions before explicitly enabling them. Even a disabled function reserves its
physical output against a second independent function owner.

The schedule template is for loads that may switch off. Essential continuous
equipment needs explicit minimum service and protection in the advanced forms.
Native timed heating profiles need a verified backend expiry contract; an ordinary
setpoint does not supply one. See [policy contracts](policy-parity.md) and
[connections](connections.md).

### 4. Optional SQL logging

Set up the SQL adapter/database separately, select that existing instance and choose
whether to store Adaptive Home observations and/or generated events. Logging begins
only after the configuration is activated. Advanced queue/batch settings are
preserved. Export uses the SQL adapter, never arbitrary SQL or history activation on
foreign device states. InfluxDB is not a supported export target here. SQL remains
optional; bounded internal history is available without it.

### 5. Validate and activate

Validate draft checks the whole configuration without activating it. Invalid input
preserves the last valid configuration. Activate changes saves a new revision;
existing enabled functions may work under the changed configuration. New guided
functions remain disabled. Reload discards unsaved edits. Previous configuration
restores a validated predecessor; it is not a replacement for a coordinated return
path to another house controller.

Concurrent changes are rejected by revision checks. Save the private draft, reload
and reconcile it with the current configuration. A valid configuration is not
physical device acceptance.

**Observe is a learning mode, not a global write stop.** Classic rules may continue
to control devices. A strictly read-only pilot needs no enabled control functions,
scenes or external control grants. Real handoff additionally requires exclusive
ownership, tested feedback/manual control, expiry and a return path.

## Advanced forms and JSON

Devices & areas, Functions, Learning and Import & channels retain detailed forms.
All editors share one draft and the same server validation.

Open **Import & channels → Advanced configuration (JSON)** for the complete draft.
Back it up privately before major edits. Select Validate JSON and use as draft;
syntax/schema failures preserve the existing draft and retain the text for repair.
Footer activation is blocked while JSON edits remain untransferred. If forms have
changed meanwhile, stale JSON cannot overwrite them: copy it privately, then replace
the editor with the current form draft and reconcile the changes. Successful JSON
validation updates the forms; only Activate changes saves the revision.

| JSON section | Purpose |
| --- | --- |
| `groups` | Area identity, display name and kind. |
| `bindings` | Physical identity, optional display `name`, integration and capabilities. |
| `bindings[].capabilities` | Exact read/write/feedback IDs, types, units, conversion, value limits, maximum age and original freshness evidence. |
| `functions` | Area, actuator, named inputs, rules, parameters, limits and enabled state. |
| `functions[].behavior`, `climate`, `nativeProgram` | Advanced manual behavior, comfort conditions and verified native heating plans. |
| `functions[].autonomy` | Learning mode, explicit permissions, parameter bounds, budgets and rollback conditions. |
| `connections`, `nativeTransports` | Optional source projections and verified heating transport contracts. |
| `sources`, `logging` | Context uses and SQL export settings. |
| `notificationRoutes`, `scenes` | Optional channels and explicitly configured shared actions. |

Example fragment inside an existing function, **not a complete import**:

```json
{
  "enabled": false,
  "parameters": { "holdMs": 1200000, "luxThreshold": 100 },
  "limits": { "commandsPerHour": 30, "manualHoldMs": 1800000 }
}
```

Keep all other required fields in the complete editor. 1,200,000 milliseconds is
20 minutes. Technical durations mostly use milliseconds; weekly times use `HH:MM`
in `timezone`. Update references consistently when changing IDs. Unknown fields,
scripts and arbitrary commands are rejected. The additive optional binding `name`
does not invalidate older configurations; older adapter packages do not understand
it, so retain a version-compatible configuration for a package rollback.

Secrets and optional access paths belong in protected instance settings or their
manufacturer adapters. Editor copies may contain device identities, room names and
recipients and must remain private. The normal export removes channel recipients;
direct editor copies may still contain them.

Missing candidates require checking the manufacturer adapter/model or using advanced
generic mapping. Missing values require checking source time, units and connection;
process uptime is not measurement evidence. A missing value is unknown, not false
or zero. Do not bypass manufacturer cooldowns with restarts. An output excluded from
simple control may lack verified writes/feedback, be imported read-only, allow only
OFF, or use a native contract requiring the advanced workflow.

Full automation remains optional and separate in Learning. The wizard never grants
it. See the [user guide](guide.en.md), [operations](operations.md),
[connections](connections.md), [compatibility](compatibility.md) and
[integration SDK](integration-sdk.md).
