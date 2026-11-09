# Freshness and policy parity corrections after Beta 3

Date: 2026-11-09. Source correction, not a replacement of the immutable Beta-3
release asset. No production device, controller configuration, installed driver
or existing house automation was changed by this work.

## Implemented and contract-verified

- Device-scoped successful read evidence is independent of event time. An old,
  unchanged value can remain valid with real fresh proof, without becoming new
  motion. Missing/future/bad/offline proof cannot rehabilitate invalid data.
  Zone-less Hue event timestamps are interpreted as UTC.
- Twenty-minute continuously observed quiet completes through the real
  HomeRuntime and Executor using a logical clock, despite the unchanged event
  exceeding a fifteen-minute event-age limit. Sensor loss, observation gaps,
  clock reversal, lost actuator evidence, manual changes and restart discard
  ownership/timers. Five-minute tests continue to require continuous observation.
- Manual OFF rearm depends on continuous quiet, including restart/gap reset.
  Repeated button codes use event time. Dim/color/physical inputs relinquish
  ownership; physical input edges use actual output state rather than an
  assumed ON. Configuration changes reset source baselines.
- Explicit departure allowlists, dark welcome holds, motion extension and
  bounded manual sessions use event edges and leases. Old startup data does
  not generate a departure, welcome or timed OFF. A new human action or return
  cancels stale preflight guards. Essential/maintenance/inhibit rules remain
  authoritative.
- Finite activation components share one physical owner, consume separate
  command quota, precede power and require all correlated feedback. Partial
  dispatch becomes uncertain/locked. Reconciliation cannot approve only the
  primary switch. `writeValues` restricts commands separately from readable
  values, including OFF-only outputs that are currently ON.
- Optional context-aware climate supports local comfort periods, start-only
  preheat, weather/person/calendar gates, usage hold, humidity-constrained deep
  idle, additional weekly heating and bounded thermal trials. No sensor offset
  changes or inferred physical heat supply are introduced.
- The finite native-profile extension compiles seven-day contents with physical
  identity, command/profile IDs, delayed activation, absolute horizon and base
  fallback. Full content echo, automatic mode, no app override and no pending
  download are required. A scalar acknowledgement is insufficient. Ambiguous
  DST folds are refused. Unverified native transport cannot be enabled.
- Admin exposes the additive schema-v1 fields through forms. Public reference
  configurations continue to work without selecting these optional modules.

## Software evidence

Typecheck, lint and build pass. The final source has **83 unit/contract tests**
and **61 package checks**. The new fixtures contain synthetic identifiers only.
They exercise normalized evidence, complete twenty-minute logical-clock
execution, manual priority races, partial compound activation, full native
content feedback, stale/app override rejection and bounded climate behavior.

The isolated js-controller 7.2.5/Admin 8.3.11 suite also exercised the actual
foreign-state APIs, hot configuration, compound feedback and an unchanged quiet
event held past its own age limit. The real Admin browser selected the new
manual-quiet setting and validated/applied the three reference configurations
in English/German with keyboard and narrow layout.

An additional pre-final candidate run passed **12 controller/browser checks**,
including a real five-minute quiet soak: **301410 ms** from quiet report to OFF,
followed by synthetic device confirmation. The emulator supplied genuine
repeated synthetic actuator reports, rather than treating its initial cached
acknowledgement as ongoing reachability. Final OFF-only/read and source-baseline
guards were subsequently covered by unit tests and a repeat of the isolated
controller/browser suite. This is software/controller evidence, not a physical
hardware or twenty-minute wall-clock test.

The final repeat passed **11 controller/browser checks** after the additional
guards. The native extension validators/compiler are exported through the public
SDK; backend implementers do not need to copy private integration code.

## Explicit remaining boundaries

The ordinary Homematic IP backend does not implement the new full-profile
content/absolute-expiry extension. Only the finite public contract and its
simulated backend are verified here. A real backend plus autonomous device
expiry/fallback still requires separate implementation/integration acceptance.
No private bridge, second cloud session or installed third-party driver patch
was substituted.

Device read-evidence producers and normalized shared presence/weather/calendar/
usage/valve sources must actually exist and enforce their documented coverage.
The core does not create missing upstream values or treat a process heartbeat as
a measurement. Platform prerequisites, unavailable resources, exclusive writer
handoff and physical feedback remain installation-specific gates.

The private configuration was completed as a disabled target draft with explicit
uncreated source/transport connection points, validated offline, and kept under
the ignored evidence directory. Its write port rejects every device write.
Private files, identities, network addresses, calendar labels and raw snapshots
are absent from the public changes. There is no productive cutover approval.

See [configuration contracts and limitations](../policy-parity.md).
