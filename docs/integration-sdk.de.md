# Hersteller erweitern (SDK v1)

Die bevorzugte Erweiterung ist ein ausdrücklich vom Betreiber installiertes JSON-Profil. Das Beispiel
`examples/integrations/lumenlab.json` verwendet einen zusätzlichen synthetischen Hersteller mit eigenen
Datenpunktstrukturen. Es erhält keinen freien Datenpunktschreiber und lädt keine Skripte oder URLs nach.

1. Definiere eine eindeutige Integrationskennung, API-Version 1 und die zulässigen ioBroker-Backendpräfixe.
2. Beschreibe geprüfte Backendversionen, exakte Datenpunktsuffixe, Quelltyp, Einheit, positive Skalierung
   und Lese-/Schreibfähigkeit. Verfügbare Metadaten begrenzen die tatsächlich mögliche Zuordnung.
3. Prüfe die Definition mit `node scripts/validate-integration.cjs profil.json` nach dem Build.
4. Verwende den gemeinsamen Vertragstest `runIntegrationContract` aus `iobroker.adaptivehome/sdk` mit
   anonymen Objekt-/Messwertbeispielen. Entdeckung darf keine Schreibfreigabe erzeugen.
5. Trage die Definition als Element der Liste `integrationProfiles` in den technischen Instanzeinstellungen
   ein. Nach Neustart steht sie zur Entdeckung und Zuordnung bereit; vorhandene Fachregeln bleiben gleich.
6. Bestätige physische Identität, Gruppenmitglieder, exklusiven Schreiber, genaue Rückmeldung und Grenzen
   im Admin. Erst eine gültige aktivierte Konfiguration kann Befehle erzeugen.

Die Paketausgaben `/sdk` und `/contracts` bilden die versionierte Schnittstelle. Unbekannte Felder,
falsche API-Versionen, doppelte Registrierungen und nicht erlaubte Typen/Einheiten/Pfade werden abgelehnt.
Suffixe sind Literale, keine frei ausführbaren regulären Ausdrücke. Neue API-Hauptversionen erfordern
eine ausdrückliche Migration. Komplexere geprüfte Erweiterungen können eine IntegrationManifest-
Implementierung beitragen; Lesen, Normalisierung, Executor, Budgets und Rückmeldungen bleiben gemeinsame
Kerndienste. Eine neue Fähigkeit braucht dokumentierte Einheit, Datengüte und konsumierende Fachregeln.

Identitäten bezeichnen den tatsächlichen Ausgang einschließlich Kanal. Gruppen müssen sämtliche
memberPhysicalIds angeben. Zuständigkeit ist vor der Aktivierung gegen andere Anbindungen abzugleichen.
Gleiche ack-Rückmeldung ist nur Backend-Beleg. Gerätebeleg setzt dokumentierte Herkunft voraus.
Unbekannte Rohcodes, Hersteller-Modellnamen oder vermeintliche native Fristen werden nicht geraten.

## Tatsächlicher Prüfstand

Shelly 12.1.1, hm-rpc 4.2.4, hmip 4.1.0, Hue 3.17.4, Philips Air 2.4.0 sowie Tradfri 3.1.3,
Matter 1.3.1 und Zigbee 3.5.5 wurden anhand öffentlicher Backendverträge und synthetischer Fälle geprüft.
Keine Kombination aus echtem Gerät, Firmware und Transport wurde hier zertifiziert. CCU und Cloud
sowie Tradfri/Matter/Zigbee bleiben getrennte Profile. Philips Air verwendet modellabhängige benannte
Stufen; rohe D-Codes, nicht belegte Einheiten und problematische Timer sind keine generische Freigabe.
Hue-Lichtwerte werden nur bei passender Quelle logarithmisch in Lux umgerechnet. Native Wochenpläne
werden nicht geschrieben, sichere native Ablauffristen werden nicht behauptet.

Für reale Freigabe Modell, Firmware, Backendversion und Transport privat dokumentieren. Erst lesend
prüfen, anschließend nur ausdrücklich freigegebene Aktoren mit gesichertem Rückweg übernehmen.
Erfolgreichen Befehl, Gerätemeldung, Handbedienung, Timeout und Wiederverbindung getrennt beobachten.
Details und Quellen: [Kompatibilitätsmatrix](compatibility.md), [englischer SDK-Vertrag](integration-sdk.md).
## Quellen und Heizprofil-Transport im Entwicklungsstand

Der aktuelle Quellstand ergänzt ausführbare Leseanschlüsse sowie die SDK-Exporte
`HmipSessionSource` und `HmipNativeEndpoint`. Die vorhandene Herstellersitzung wird
wiederverwendet. Eine gepflegte Backend-Erweiterung muss die Nachrichten registrieren;
installierte Fremdadapter werden nicht verändert. Ein Wochenprofil allein belegt keinen
absoluten einmaligen Ablauf. Ohne echten Geräte-/Servernachweis bleibt die Steuerung
gesperrt. Details: [Quellenverbindungen](connections.md).

## Passives HmIP-Lesen im Entwicklungsstand nach Beta 9

`hmipPassiveConnection` erzeugt eine gewöhnliche `state-map`-Verbindung aus
ausdrücklich ausgewählten Datenpunkten des vorhandenen HmIP-Adapters. Es gibt
keine zusätzlichen REST-Aufrufe, Backend-Nachrichten, Anmeldungen oder einen
Cloud-Ersatzweg. Der Herstelleradapter wird nicht verändert oder neu gestartet.
Ein vollständiges anonymes Beispiel steht unter
[examples/hmip-passive.json](../examples/hmip-passive.json).

Pro Feld werden Instanz, Datenpunkt, Typ, Einheit, Grenzen und optionale
Identitäts-/Erreichbarkeitsbedingungen angegeben. `stateIds` mit `aggregate`
ermöglicht vollständige Maximalwert- oder Boolesche Zusammenfassungen. Alle
beteiligten Werte müssen gültig sein. Prozentwerte werden nur mit belegter Einheit
umgerechnet; Fristen bleiben konfigurierbar und sind keine Aktualisierungsgarantie.

Der ursprüngliche bestätigte Empfangszeitpunkt (`ts`) bleibt der Frischenachweis,
der Änderungszeitpunkt (`lc`) der Ereigniszeitpunkt. Ein lokaler Abruf und der
Verbindungsstatus frischen nichts auf. Fehlende, unbestätigte oder alte Werte bleiben
unbekannt; sie lösen keine Cloudabfrage aus. `activeProfile` ist nur die Profilkennung,
kein vollständiger Wochenplan und keine Freigabe zur Aktorübernahme.

Die bisherige REST-Leseverbindung muss deaktiviert oder ersetzt werden. Insbesondere
ist `readOnlyHmipPort` zwar gegen Aktorbefehle geschützt, aber **nicht passiv**.
Der erzeugte Quellenentwurf ist mit dem vorhandenen Beta-9-Schema nutzbar. Der neue
SDK-Export und die Wetterkorrektur werden erst mit einem späteren Softwareupdate
Bestandteil des laufenden Adapters; veröffentlichte Beta-9-Pakete bleiben unverändert.

Die Wetterkorrektur im selben Entwicklungsstand prüft die ausgewählten Punkte
und jeden zugehörigen Empfangsbeleg. Änderungen an ungenutzten Punkten blockieren
die Auswahl nicht mehr. Bei `forecast.points.timestamps` belegt ein Zeitstempel den
ganzen Punkt, zwei stehen in der Reihenfolge Minimum/Maximum, drei in der Reihenfolge
Gültigkeitszeit/Minimum/Maximum. Eigene Konfigurationen müssen diese Reihenfolge
einhalten. Die älteste ausgewählte Bestätigung bleibt erhalten; ein Zeitfensterwechsel
erzeugt keinen neuen Messbeleg. Stille Änderungen, rückwärts laufende oder zukünftige
Empfangszeiten werden nicht als gültig übernommen.
