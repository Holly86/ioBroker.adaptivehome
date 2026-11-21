# Beta 10 read-only installation verification

The published Beta 10 archive was installed after its complete isolated release checks and
repeat checks of the published download. The bounded change replaced only AdaptiveHome's
package and Admin files and restarted only that adapter. Manufacturer adapters, the passive
context reader, ioBroker itself and existing house services were not restarted.

Before the change, the affected old package files and metadata/configuration snapshot were
secured privately and downloaded to the PC. All 155 previous package files were restored
and hash-checked there; affected root metadata and configuration validation passed for both
Beta 9 and Beta 10. Eight isolated installer tests covered exact restore, six interruption
phases and protection of a newer configuration. A further process-evidence test covered
exact process titles, start ticks and duplicate detection.

The active source-only configuration and own native settings remained unchanged. Functions,
write mappings, native control transports and commissioning stayed disabled. The passive
HmIP source reads existing manufacturer states; the legacy REST source was not restored.
The existing pinned manufacturer hook and its SDK files stayed unchanged. Its additional-read
counters did not increase. No actor command or house-rule change was issued.

The installed 158 package files and 20 uploaded Admin files matched the published archive.
The applied configuration matched the retained source configuration. The adapter was ready;
its command journal remained empty, and repeated local Admin status reads reported no source
connection error. Other adapter process identities/start ticks and all seven container
identities/start times/restart counts remained unchanged. Protected house configuration/code
files also matched. The same new AdaptiveHome process remained present through 254647 ms
of bounded post-start observation; the observed stopped-to-started interval was 14491 ms.

A snapshot replay of the exact frozen Beta 10 projector against existing local state inputs
accepted the weather projection without network/backend calls. This is separate from live
process status and anonymous controller tests. Old HmIP reports still expire under the
unchanged age limits. Inactive, missing or old reports in other optional sources remain
unusable. No report time was rewritten, no cloud guard was reset and no refresh was requested.

The first private verification helper attempted an unavailable database convenience method;
a read-only verifier using supported local database reads and the existing Admin status API
completed successfully. This required no additional adapter restart or product-code change.

This is a successful bounded software installation and read/shadow start check. It is not a
new 24-hour stability acceptance, physical actuator acceptance or permission to take over
production control. Private raw evidence, access details and household identifiers remain
outside the public repository and archive.
