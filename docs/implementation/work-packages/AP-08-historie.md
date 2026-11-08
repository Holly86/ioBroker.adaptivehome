# AP-08 Beobachtungen Historie und Erklärungen

Voraussetzungen: AP-03, AP-04.

## Verbindliche Ergebnisse

- Gemeinsame Ereignis- und Messwerthistorie mit Quellenbezug
- Datenaufbewahrung, bereinigte Diagnose und Lernexport

## Abnahme

- Entscheidung und echte Rückmeldung lassen sich vom Admin bis zum Journal nachvollziehen.
- Historienlücken und unzureichende Messung werden nicht als Verbrauch Null oder erfolgreiche Wirkung dargestellt.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-08 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere eine begrenzte, versionierte Beobachtungs- und Ereignishistorie für Diagnose und Lernen. Nutze vorhandene ioBroker-Historien über eine definierte Leseschnittstelle oder einen begründeten lokalen Speicher, ohne ein weiteres zwingendes Datenbanksystem einzuführen.
Speichere Messzeit, Empfang, Qualität, Konfigurations- und Modellbezug sowie Aufträge und Rückmeldungen. Vermeide unnötige Wiederholungen, erhalte aber relevante Übergänge. Lege Retention, Rotation, Datenlöschung und einen bereinigten Supportexport fest. Bewegungsdaten und Empfängerinformationen sind nicht automatisch öffentliche Diagnosedaten. Zeige Unterversorgung, unbestätigten Befehl und fehlende Wärmebereitstellung als unterschiedliche Sachverhalte. Energie ist nur bei geeigneter Messgrundlage gemessen; Leistungsintegration und Schätzungen tragen ihre Abdeckung. Stelle den späteren Lernverfahren einen stabilen anonymisierbaren Datenvertrag zur Verfügung und teste defekte Zeilen, Lücken, Zeitsprünge und Speicherausfall ohne Schaltstopp unabhängiger Funktionen.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-08.md. Private Rohdaten gehören nur nach .local/evidence/AP-08/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
