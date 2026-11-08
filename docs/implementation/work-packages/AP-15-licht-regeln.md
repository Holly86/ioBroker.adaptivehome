# AP-15 Allgemeine Licht und Schaltregeln

Voraussetzungen: AP-05, AP-06, AP-07, AP-08, AP-09, AP-11.

## Verbindliche Ergebnisse

- Konfigurierbare Zeit-/Sensor-/Nutzungsregeln und Szenen
- Eigentum, Handbedienung, Nachlauf und konkrete Ablehnungsgründe

## Abnahme

- Bewegung schaltet nur zugeordnete Leuchten bei zulässiger Helligkeit ein und nach konfigurierter Ruhe wieder aus.
- Eine manuell eingeschaltete oder ausgeschlossene Leuchte wird nicht von einem alten Automatiktimer ausgeschaltet.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-15 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere allgemeine Licht- und einfache Schaltfunktionen über Fähigkeiten. Der Nutzer wählt Auslöser, Helligkeitsschwellen, Hysterese, Zeitfenster, Nachlauf, manuelle Sperre und Ausnahmen. Mehrere Geräte und unterschiedliche Hersteller können gemeinsam genutzt werden, ohne pauschal eine Herstellergruppe mit unbekannten Mitgliedern zu schalten.
Die Automatik beendet nur ihre tatsächlich bestätigte eigene Einschaltung. Neue Bewegung verlängert den gültigen Nachlauf; ein alter Timer darf nach einem manuellen Aus/Ein keinen neuen Zustand ausschalten. Unterstütze konfigurierbare Hausszenen, ohne unverzichtbare Anlagen in ein allgemeines Away-Off aufzunehmen. Protokolliere einmalig pro neuem Ereignis konkrete Ablehnungsgründe und relevante geprüfte Bedingungen. Prüfe fünfminütigen Referenznachlauf, manuelle Vorränge, Sensorverlust, Zeitstempelgrenzen, Wiederverbindung und Neustart. Die reale End-to-End-Probe unterscheidet Bewegungsentscheidung, Gerätebestätigung und tatsächlichen Ablauf; ein direkter Schaltversuch allein ist keine Bewegungsabnahme.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-15.md. Private Rohdaten gehören nur nach .local/evidence/AP-15/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
