# Beta 8 long-term read-only observation

The actual 24-hour observation window completed. Collection had no recorded stream
sequence gap, collector error or observer error. This is a completed diagnostic
window, **not a passed stability acceptance or a production cutover approval**.

The installed Beta-8 product files matched their original published file manifest
throughout the sampled hourly checks and the final comparison. Its configuration,
native instance settings and selected active house flows remained unchanged. The
configuration stayed source-only, without control functions, confirmed actuator
bindings, write mappings, native control transports or an enabled SQL exporter.

## Remaining source and operational findings

- The existing shared heating read path received rate-limited responses. Its
  conservative shared cooldown was respected; one automatic recovery was observed
  before another rejection. These local cooldown lengths do not establish a
  manufacturer quota.
- The user confirmed parallel maintenance during observation. A changed manufacturer
  backend file and adapter restarts invalidated the original read-host integrity
  pin. The host refused registration as designed; the installed product subsequently
  reported source timeouts. Later missing reads cannot all be attributed to the
  earlier rate limiting.
- The unchanged private context reader intermittently rejected original-time or
  concurrent-read evidence for operator/usage inputs. Its prepared correction was
  not installed during this observation.
- Optional unavailable devices, missing events and historical vacuum, presence,
  energy and media values remain explicit. Selected weather and warning inputs were
  valid at all collected runtime sample points; this is not proof of continuous
  validity between samples. Unused/unavailable sources can be excluded deliberately.
- An existing private heating worker exited after its own snapshot deadline; later
  service start changes occurred during the maintenance phase. A separate existing
  integration service had one unhealthy sampled check followed by a healthy check.
  No service lifecycle action was issued by this observer. Indirect effects of
  general system load on the earlier snapshot timeout were not ruled out.

The private report separates actual runtime connection errors, passively observed
callbacks, typed mapping checks and an independent projection mirror. Replaying an
old relative cooldown diagnostic can extend the mirror's own wait; mirror retry
times are not used as the authoritative production transport chronology. Repeated
baseline-drift samples are not counted as independent service restarts.

Evidence was collected privately on the development PC. A bounded temporary process
read runtime/source status, passively listened to existing heating read traffic and
checked projection health. Fixed local device status GETs were read-only. The
observer sent no additional heating backend request, actuator command, house-rule
change or existing-service restart. The temporary observer exited after completion.
Existing automation and the user's parallel maintenance are distinct from these
observer guarantees.

Before another acceptance, reconcile and verify the post-maintenance backend/read
host, correct the private context evidence, select required sources and establish a
fresh inventory. A new uninterrupted 24-hour window without parallel maintenance
is required for an unchanged-stand stability claim. Physical expiry, App priority,
actuator handoff and rollback remain separately unaccepted.

The guided Admin work after Beta 8 was tested separately in an isolated installation;
it was not installed into this observed instance. Raw timestamps, topology, values,
identifiers, tools and detailed source reports remain ignored private evidence.
