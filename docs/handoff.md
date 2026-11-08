# Betriebsübergabe — Adaptive Home

Stand: 2026-11-08. Produktversion: 0.1.0-beta.3.

Repository: https://github.com/Holly86/ioBroker.adaptivehome
Release: https://github.com/Holly86/ioBroker.adaptivehome/releases/tag/v0.1.0-beta.3
Produktdateien liegen ausschließlich im eigenen Repository. Private Hauskonfigurationen,
Zugangsdaten und Rohprotokolle wurden nicht übernommen. Die bestehende Haussteuerung wurde nicht geändert.

## Installation und Einrichtung

Das gebaute tgz und SHA256SUMS aus dem Release herunterladen. Prüfsumme vergleichen. In der
ioBroker-Installation das tgz mit npm installieren, `iobroker upload adaptivehome` und anschließend
`iobroker add adaptivehome --enabled` ausführen. Node 22.19+/24, Controller 7.2.5+ und Admin 8.3.11+
werden benötigt. Der GitHub-Quelltext-Download ersetzt das gebaute Installationspaket nicht.

Im Admin den Reiter Adaptive Home öffnen. Räume oder beliebig benannte Anlagen anlegen, vorhandene
Gerätefähigkeiten auswählen und die physische Identität einschließlich Gruppenmitgliedern bestätigen.
Lese-/Schreib-/Rückmeldepunkt, Einheit und Wertzuordnung prüfen. Andere Automatikschreiber vor einer
Aktorübernahme stoppen. Funktionen mit Eingängen, Zeitplänen, Schutzbedingungen, Mindestfunktion und
Befehlsbudget anlegen. Entwurf prüfen und vollständig aktivieren. Die drei Beispiele bleiben synthetisch.

## Normalbetrieb und Lernen

Die Übersicht zeigt Ziel, Rückmeldung, Datengüte und Grund. Klassische Regeln arbeiten ohne Lernen,
Nachrichtenkonto oder Sprachmodell. Beobachten trainiert ohne Aktivierung. Vorschlagen erfordert eine
Planannahme. Begrenzt automatisch verändert freigegebene Parameter. Vollautomatisch darf nach
Einrichtung der jeweiligen Freigabe auch erlaubte Regelkombinationen aktivieren, die Gerätewirkung
prüfen und bei Verschlechterung zurücknehmen. Keine Einzelrückfrage innerhalb dieser Freigabe.

Freigaben gelten pro Funktion mit Fähigkeiten, Bereichen, Regelbausteinen, Datengüte, Änderungsbudget
und Bewertungszielen. Essenzielle/ausgeschlossene Funktionen sind keine Optimierungsziele. Harte Grenzen,
Schutz und Handvorrang bleiben wirksam. Lernen benötigt ausreichende abgeschlossene Beobachtungstage;
fehlende Belege lassen klassische Steuerung bestehen. Dispatch, Backendmeldung, Gerätemeldung und
beobachtete Umweltwirkung sind verschiedene Nachweise. Der Hersteller-SDK lädt deklarative Profile,
keine Modellskripte, und erfordert keine Änderung vorhandener Fachregeln.

## Diagnose und Rückweg

Bei unklaren Befehlen Verbindung und Rückmeldepfad prüfen, frischen Zustand abgleichen und gezielt
fortsetzen. Quoten/Unsicherheit nicht durch Löschen der Journale umgehen. Handvorrang ausdrücklich
aufheben; neue Handwünsche bleiben bei Lernrücknahme erhalten. Lernen pausieren, abbrechen oder
zurücknehmen entfernt die Anpassung; klassische Regeln bleiben aktiv. Für vollständigen Befehlsstopp
Funktion deaktivieren oder Instanz stoppen. Geräte können ihren letzten Wert bzw. nativen Betrieb behalten.

Vor Updates Konfiguration exportieren und ioBroker sichern. Instanz stoppen, geprüftes Paket installieren,
Admin-Dateien hochladen und starten. Vorige Konfiguration erzeugt eine gültige neue Revision. Bei
Paketproblemen eine frühere geprüfte Version samt kompatiblem Backup wiederherstellen. Es gibt keine ältere Produktivversion. Beta 1 hat eine bekannte Zuständigkeitslücke und ist kein Rückweg bei Aliasproblemen. Übernahme/Rücknahme bleiben ohne zweiten Schreiber.

## Daten und externe Voraussetzungen

Messhistorie wird nach sieben Tagen und bei 10.000 Beobachtungen begrenzt; das Ereignisjournal ist
ebenfalls begrenzt. Modelle/Pläne und Befehls-/Budget-/Bedienjournale sind getrennt. Verlauf löschen
entfernt nicht automatisch sämtliche Modelle/Pläne. Datenbank, Backup und gewöhnliche Konfigurationsexporte
bleiben privat. Der reduzierte Supportexport entfernt Messwerte, Datenpunktkennungen, Empfänger und
freie Fehlertexte. Optionale Modellaufrufe verlangen Freigabe für Zusammenfassungen und Kostenbudgets.

Reale Freigaben benötigen jeweils Modell, Firmware, Backendversion und Transport sowie beobachtete
Befehle, Gerätemeldungen, Handbedienung, Timeout und Wiederverbindung. CCU und Cloud sowie IKEA über
Tradfri/Matter/Zigbee werden getrennt geprüft. Native Wochenplan-Inhalte und zertifizierte native
Ablauffristen werden nicht behauptet. Gerätewirkung und echte Haushaltseinsparungen sind nicht belegt.

Nachrichtenkonten benötigen ausdrücklich bestimmte eigene Empfänger; Telegram-Bedienung zusätzlich ein
vertrauenswürdiges Gateway mit ursprünglicher Nutzer-/Chat-Information und signierten Aufträgen. Echte
Ollama-/Cloudanbieteraufrufe benötigen gesonderte Server-/Kontoeinrichtung. Alle diese Dienste sind optional.
Für npm fehlen hier Anmeldung/Publikationsrechte. Danach folgen Beta-dist-tag, ioBroker-Paketmitbesitz,
Adapter-Checker/Latest-Antrag und erst nach weiteren Tests eine gesonderte Stable-Freigabe.
Ein privater Pilot beginnt lesend/Shadow; Aktorübergabe benötigt konkrete Zuständigkeit, Mindestfunktion,
letzte gültige Konfiguration und Rückweg. Siehe [Pilotvoraussetzungen](pilot.md).

Prüfdetails: [Szenariomatrix](verification/scenarios.md), [Kompatibilität](compatibility.md),
[deutsche Anleitung](guide.de.md), [SDK](integration-sdk.de.md) und das alleinige
[AP-Manifest](implementation/work-packages.json).

## Abschließender Prüfstand

Aktuelle Veröffentlichung ist 0.1.0-beta.3. Pro physischem Ausgang gilt genau eine Funktion, auch bei
deaktivierten Aliasfunktionen; Zeitpläne, Bedingungen und Grenzen innerhalb dieser Funktion zusammenführen.
Vor einem Update von Beta 1 überlappende Aliase im Admin entfernen und privat sichern. Beta 1 ist mit
einem entsprechenden Hinweis versehen. Mindestfunktion und harte Grenzen werden zusätzlich im Executor geprüft.

60 Modul-/Vertragstests, 61 Paketprüfungen, elf Controller-/Browser-/Langlaufprüfungen und alle sieben
Plattformprüfaufträge bestehen. Das exakt geprüfte Paket lief in drei Konfigurationen mit abweichenden
Zeitzonen, Geräteanzahlen und Herstellerkombinationen. Nach Veröffentlichung wurden Download, Prüfsumme
und GitHub-Digest mit dem unveränderten Testpaket verglichen: bytegleich. Der echte Nachlauf dauerte
300666 ms; alle 80 installierten Laufzeit-/Admin-Dateien stimmen überein.

Beta 3 enthält die geprüften Erkennungskorrekturen. Gespeicherte Bindungen werden dadurch nicht
stillschweigend umgeschrieben. Mehrdeutige Hue-Aliase und unbestätigte Modelle/Quellen bleiben gesperrt
bzw. lesend. Die vorhandene Haussteuerung wurde für diese Veröffentlichung nicht angesprochen.
Das Manifest weist weiterhin alle 28 APs als implementiert aus; 20 sind geprüft, acht haben ausschließlich
die dort konkret genannten externen Geräte-/Kontonachweise offen.
