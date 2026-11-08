# Optional private pilot — prerequisites

The public beta authorizes no blanket takeover of an existing installation. No home controller was
changed during development. A pilot begins read-only/shadow with exported private bindings and no
second actuator writer. Keep its raw inventory, measurements and identifiers outside public files.

Learning mode `observe` only blocks learned activation; configured classical rules can still actuate.
For a strictly read-only shadow pilot, use cache-read APIs and pure discovery/normalization/policy functions
without starting the adapter lifecycle, HomeRuntime or Executor and without providing a write port.
Keep stale/invalid data unchanged in the assessment: do not refresh timestamps, enable backends or
update existing software to make a pilot pass. Unresolved aliases and model conflicts remain explicit gaps.

For each proposed output record exact model/firmware/backend, exclusive current owner, readable
feedback, native minimum behavior through adapter outage, last valid configuration and a tested
rollback route. Verify sensor freshness and compare shadow decisions before writing. Native expiry
requires its own documented device report; elapsed time is insufficient.

Actuator transfer needs specific authorized scope. Stop the old writer first, then enable the new
mapping. Rollback reverses that sequence. Preserve new manual wishes. Do not perform hazardous
pump/water/animal tests without established minimum flow, protection, supervision and recovery.
Missing hardware or pilot permission leaves only that evidence pending; it does not invalidate the
separate public controller/emulator acceptance.
