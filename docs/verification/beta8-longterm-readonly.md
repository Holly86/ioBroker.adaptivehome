# Beta 8 long-term read-only observation

The newly requested observation is in progress. Completion of the actual
24-hour window has not yet been established.

The installed product was checked against the published Beta 8 file manifest.
Its configuration remains source-only, with no control functions, confirmed
actuator bindings, write mappings, native control transports or enabled SQL
exporter. Existing polling-aware source windows remain unchanged.

Evidence is collected privately on the development PC. A bounded observer reads
the actual runtime status and source data, passively listens to existing heating
read traffic and checks source timestamps and projection health. Local device
status reads use fixed read-only routes; the observer sends no additional heating
backend request. Periodic checks cover installed files, instance configuration,
house policies, active flows and service identities. The observer is a temporary
read-only process, not a newly installed service.

The observation does not restart existing services, change house rules or issue
actuator commands. Source failures, rejected reads, transient projection errors,
configuration drift and collection gaps remain explicit rather than being
repaired during acceptance. Physical expiry, App priority and actuator handoff
remain outside this observation.

Raw timestamps, topology, source values, identifiers and monitoring tools remain
ignored private evidence. The final assessment will distinguish the actual
observed period from coverage gaps and remaining source limitations.
