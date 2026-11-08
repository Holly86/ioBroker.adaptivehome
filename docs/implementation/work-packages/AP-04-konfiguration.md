# AP-04 Konfiguration Zeitpläne und Migration

Voraussetzungen: AP-03.

## Verbindliche Ergebnisse

- Schema, Transaktionen, aktive Revision und letzte gültige Konfiguration
- Wochen-/Ausnahmepläne, Import, Export und Versionsmigration

## Abnahme

- Eine ungültige Teiländerung gelangt nicht in die aktive Steuerung.
- Alltagswerte werden ohne Gesamtsystem-Neustart angewendet; Export enthält keine Geheimnisse.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-04 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere den maßgeblichen Konfigurationsspeicher in ioBroker und die zugehörige Validierung. Erlaube mehrere Räume, Anlagen und Funktionsinstanzen mit auswählbaren Quellen, Betriebsarten, Grenzen und Zeitplänen. Entwurf, aktive Revision und tatsächlich angewandte Revision müssen unterscheidbar bleiben.
Implementiere tägliche, wöchentliche und befristete Pläne, Ausnahmen, lokale Zeitzone, Sommerzeit sowie eindeutige Ablaufzeitpunkte. Änderungen werden zusammenhängend geprüft und aktiviert; widersprüchliche harte Regeln benötigen eine verständliche Fehlermeldung. Stelle Schema-Migration, bereinigten Export, Import-Vorschau und Rücknahme bereit. Zwischenzeitliche Nutzeränderungen dürfen beim Zurücknehmen nicht verloren gehen. Gewöhnliche Sollwerte und Nachlaufzeiten sollen live anwendbar sein. Baue Tests für über Mitternacht reichende Pläne, doppelte Nachrichten, ungültige Bereiche, alte Revisionsstände und unterbrochene Aktivierung. Der Export ist ein portables Produktschema, kein Abbild privater Adapterzugänge oder historischer Bewegungsdaten.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-04.md. Private Rohdaten gehören nur nach .local/evidence/AP-04/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
