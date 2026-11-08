# User guide

## Setup

Install the built release following the README. Enable the Adaptive Home Admin tab and keep Admin
authenticated. This product trusts its message transport; an untrusted adapter with administrative
database access is outside that boundary. Instance settings contain optional SDK definitions, remote
clients/secrets and model providers. Daily setup uses the bilingual tab.

1. Under Devices & areas, add rooms or installations. Discover states or create generic mappings.
   Check actual instance/channel, metadata, units, source scaling/enums and read/write/feedback paths.
   Confirm physical identities and group members. Shared acknowledgments normally mean backend
   evidence; choose device evidence only for documented device reports. Each output needs one owner.
2. Under Functions, choose lighting, climate, air or equipment. Assign actuator and available named
   inputs. Configure parameters, conditions, timezone/windows/date exceptions, protection, dependencies,
   minimum dwell times and budgets. Essential equipment needs an explicit minimum value. A relay
   alone does not establish dry-run, water or animal protection.
3. Validate and activate the complete draft. Refresh after conflicting revisions. Overview compares
   desired and reported values, quality and decision reasons. Remove competing automatic writers
   before taking over an actuator. Missing inputs remain unknown, never false.

## Three reference cases

Import an example under Import & channels, then edit it with forms. Replace every `test.0` path and
synthetic identity before using real devices.

* Apartment: motion and lux drive light with five minutes of continuous quiet. Fresh post-start
  movement grants automatic ownership. New movement extends the deadline. Manual changes/restart
  invalidate old timers; an already-on foreign light is preserved. Climate is a separate function.
* Aquarium or other installation: daylight and essential circulation are independent. Daylight can
  stop while circulation continues. Verified protection can override minimum service. This example
  grants no live water/animal-test authorization.
* Air-quality area: choose actual units, threshold, hysteresis and fan values. Philips Air may use
  ordinal modes rather than percentages. Unknown models/codes remain unavailable.

Native device programs supply their own fallback during adapter/controller outages. Unsupported
native expiration is not presented as a safe device guarantee. Independent minimum service can
continue when another function lacks context.

## Learning

Start in Classic or Observe. Local usage, air-demand and thermal models use completed days with
chronological holdout and coverage/gap checks in bounded workers. Typically at least four full days
and sufficient positive observations are needed. An unqualified model leaves classical rules active.

Grant each function its capability, numeric parameter ranges and allowed schedule/sensor/presence
blocks. Set change budget, maximum data gap, evaluation interval and objectives. Essential/excluded
functions are not optimization targets. Suggest needs deliberate acceptance. Bounded activates
parameters only. Full also activates allowed rule combinations without per-change dialogs.

Activation requires a current admitted model and comparable baseline observations. Every command
passes ordinary hard limits. Plans record command IDs and feedback quality. Later observations
are compared with baseline. Degradation, uncertainty, missing evidence, expiry or new manual/configuration
choices remove the overlay and restore a valid previous plan or classical policy. This comparison
does not control environmental causes and does not prove energy savings.

Pause disables the learned overlay; classical rules continue. Resume revalidates the grant. Cancel/
revert removes the plan. Disable a function to stop its commands.
Stopping the instance stops the adapter. Devices can retain their last value.

## Optional services

Routes specify your intended Telegram/Pushover/email adapter and recipient, severity, scope and quiet
hours. Incidents are persisted/bundled; channel acceptance does not prove delivery. Controls require
a trusted gateway with original user/chat metadata, narrow scope, a 32+ character secret and signed,
expiring revision-bound envelopes with replay protection. Forwarded/edited/stale updates are rejected
by the sample gateway; plain Telegram text lacks that proof. Email/Pushover are notification-only.
See [control protocol](control-protocol.md).

Providers need an explicit HTTPS endpoint (loopback HTTP allowed), model, scopes, summary consent
and request/cost budgets. HTTP-JSON, Ollama and OpenAI-compatible responses are supported. Requests
return strictly structured candidates for inspection, not scripts or direct state writes. Local full
automation is independent of providers. No paid calls or real account delivery were performed for
this beta. See [operations](operations.md) for private data, diagnostics, updates and rollback.

Beta 2 requires exactly one function per physical output, including disabled aliases. Combine schedules, conditions and hard limits within that function. Before upgrading beta 1, export/backup and remove overlapping function aliases using its Admin. Ambiguous saved configurations are rejected; restore a valid private configuration rather than allowing an automatic guess about ownership.
