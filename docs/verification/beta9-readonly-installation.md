# Beta 9 bounded read-only installation verification

The [published Beta-9 package](https://github.com/Holly86/ioBroker.adaptivehome/releases/tag/v0.1.0-beta.9)
was installed separately from its [public release verification](beta9-release.md).
Private raw configurations, manufacturer identifiers, session material, hooks and context-reader
deployment files remain outside the public repository and package.

A fresh official backup was downloaded and restored on the development PC using the original
controller database-restoration implementation. No original device adapter was started.
The scoped installer passed 14 isolated checks, including four interrupted-install boundaries
and rollback that retains later independent wishes. Six context-reader switch/rollback checks
and an additional original-receipt cache/expiry configuration check passed. These isolated
lifecycle tests do not certify physical device handoff.

The immediately preceding live inventory matched the reviewed baseline. Existing manufacturer
code, API and shared provider guard were retained; the private read-only hook uses newly reviewed
integrity pins. It shares the existing authenticated backend and a 120-second cache. Both the
connection's source-evidence maximum age and associated mapping freshness limits are 180 seconds.
This is explicit private configuration; the public SDK default was not silently changed.
Cache reads retain the original receipt, and provider cooldowns are not reset or shortened.

The context reader evaluates time after reading and retries bounded inconsistent file generations.
It retains original source times and rejects genuine missing/stale/future evidence. Its installed
files match the tested version. Its fixed image, process command, user and environment values
were retained, with no network, read-only root filesystem and read-only inputs. Only its own
projection output is writable. Its prior stopped container is retained for scoped rollback.

Only AdaptiveHome, the existing HmIP adapter and this context reader were deliberately reloaded.
AdaptiveHome observation was interrupted for approximately 22 seconds; HmIP registration recovered
approximately six seconds after the stopped-state checkpoint. No controller, Admin, lighting,
heating-policy, Node-RED or other existing writer service restart was requested. All 155 installed
product files and all 20 uploaded Admin files match. Other instance settings and manufacturer
file hashes remain unchanged.

The actual bounded observation lasted **601304 ms**, with no collection error, control-scope
violation or gap. It passively observed 41 existing backend replies; all 39 projected HmIP outputs
and 47 associated mappings were valid. Six distinct original receipts advanced at intervals of
120–136 seconds. A separate paced read-only inspection retrieved eight complete native profiles;
control and physical-expiry registration remained disabled. All nine context proofs passed
121 samples without error. Final file/configuration checks, other container identities/start
times and active Node-RED flows matched their expected boundaries. The temporary observer exited.

No actuator command, profile mutation or house-rule change was performed. Functions, confirmed
write bindings, native control transports, scenes, notification routes, external control clients,
commissioning and production SQL export remain absent or disabled. The new Admin setup and offline
help are installed; they were verified through synthetic real-Admin browser checks rather than by
activating a private household configuration.

Remaining compatibility findings are separate: two Hue projections remain invalid; historical
raw values from optional vacuum, presence, PV, remote-control, voice-assistant and other legacy
sources remain stale or unavailable. Supported independent projections do not turn those old raw
states into fresh evidence. A deliberately disconnected optional fan remains unavailable. Weather
and warning sources were valid in this observation. Private per-source details are retained privately.

The scoped read installation and short observation passed. Overall source compatibility remains
partial. A new unchanged **24-hour stability acceptance**, valid inputs for each intended function,
and physical native expiry, App priority, exclusive writer handoff and rollback acceptance are
still required before control takeover. No actuator cutover was performed.
