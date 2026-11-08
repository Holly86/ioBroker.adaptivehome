# AP-17 Allgemeine Anlagen Pumpen und Dauerbetrieb

Voraussetzungen: AP-05, AP-06, AP-07, AP-08, AP-09.

## Verbindliche Ergebnisse

- Frei benannte Anlagen mit Zeit-, Dauer-, Intervall- und Bedarfsbetrieb
- Technische Mindestfunktionen und konfigurierbare Schutzbedingungen

## Abnahme

- Aquarium und optionale Wasser-/Filteranlage verwenden dieselben konfigurierbaren Module.
- Dauerbetrieb wird weder bei Abwesenheit noch für ein ungesichertes Energieziel unerwartet abgeschaltet.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-17 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Implementiere die allgemeine Anlagensteuerung, ohne Poolparameter als Pflichtmodell einzuführen. Unterstütze schaltbare und gegebenenfalls regelbare Verbraucher mit Dauerbetrieb, Zeitfenstern, Intervallen, bedarfsabhängigem Betrieb, Mindestlauf, Mindestpause und Schaltbudget. Physikalische Größen wie Durchfluss oder Volumen sind zusätzliche optionale Fähigkeiten bzw. Nutzerparameter mit Herkunft und Prüfstatus.
Eine unverzichtbare Umwälzung kann eine zugesicherte Mindestfunktion erhalten. Nutzerdefinierte technische Schutzbedingungen haben eine ausdrücklich dokumentierte Priorität; weder global AUS noch global EIN ist eine sichere Universalregel. Unbekannte Messung wird nicht als gesicherter Durchfluss interpretiert. Implementiere einen konsistenten Ressourcen-/Abhängigkeitsgraph für zusammengehörige Verbraucher und bestätigte Befehle. Prüfe Referenzanlage mit Dauerpumpe und Tageslicht sowie eine unabhängig konfigurierte Intervallanlage. Reale Wasser-, Tier- oder Trockenlaufschutztests benötigen die tatsächlich eingerichteten Voraussetzungen; gefährliche Probebetriebe werden nicht aus Simulationsergebnissen freigegeben.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-17.md. Private Rohdaten gehören nur nach .local/evidence/AP-17/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
