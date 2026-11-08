# AP-24 Ausfälle Datenfehler und Gesamtsystemtests

Voraussetzungen: AP-09, AP-10, AP-11, AP-12, AP-13, AP-14, AP-15, AP-16, AP-17, AP-18, AP-19, AP-20, AP-21, AP-22, AP-23.

## Verbindliche Ergebnisse

- Automatisierte Fehler-, Integrations-, Browser- und Wiederanlauftests
- Nachvollziehbare Berechtigungs-, Daten- und Veröffentlichungsprüfung

## Abnahme

- Ausfall optionaler Module oder einer Funktionsinstanz führt nicht zum globalen Regelstopp.
- Die verbindlichen Szenarien bestehen oder haben eine konkrete überprüfbare offene Hardware-/Accountvoraussetzung.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-24 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Prüfe das integrierte Produkt anhand ACCEPTANCE.md, nicht nur seine Einzelmodule. Teste verzögerte und doppelte Rückmeldungen, eigene Profilzwischenwerte, fehlende Node-RED-Umgebung, ausgefallene Quellen, ungültige Modelle, lokale Limits, Zeitsprünge, Neustart, Speicherfehler und parallel eintreffende Handbedienung.
Prüfe Zustand und Wirkung vor und nach Rücknahme. Reproduziere die wichtigen historischen Fehler als allgemeine anonyme Regression: erfolgloser erster Autoritätscheck hängt nicht dauerhaft fest; fehlende Einzelraumfreigabe blockiert keine anderen; leicht zukünftige Bewegung geht nicht verloren; manuelle Gerätezuständigkeit bleibt erhalten. Ergänze angemessene Langlaufmessungen mit tatsächlicher Laufzeit statt vorgetäuschten Stunden. Prüfe Berechtigungen, unzulässige Datenpunktwahl, unbekannte Plugin-IDs, fremde Nachrichtentexte und Datenexport. Keine unbereinigten Rohdaten veröffentlichen. Ein laufender Prozess oder ein Mock der eigenen Implementierung ist keine unabhängige Funktionsabnahme. Halte echte Grenzen und reproduzierbare Fehler mit Nachweisen fest.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-24.md. Private Rohdaten gehören nur nach .local/evidence/AP-24/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
