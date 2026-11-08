# AP-23 Geschlossene volle Automatisierung

Voraussetzungen: AP-05, AP-06, AP-08, AP-19, AP-22.

## Verbindliche Ergebnisse

- Alle fünf tatsächlichen Lernmodi mit selbstständiger Planaktivierung
- Wirkungsbewertung, manuelle Unterbrechung und automatische Rücknahme

## Abnahme

- Vollautomatisch aktiviert zulässige gelernte Parameter und neue erlaubte Regelkombinationen ohne jeden Änderungsdialog.
- Fehlwirkung löst passende Rücknahme aus; neue menschliche Änderungen bleiben dabei erhalten.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-23 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Implementiere AUTONOMY.md vollständig bis zur vollen Automatisierung. Der Nutzer richtet einmal Funktionsumfang, erlaubte Regelbausteine, harte Grenzen, Ziele und Budgets ein. Danach soll der geschlossene Ablauf selbst beobachten, lernen, planen, validieren, aktivieren, bestätigen, Wirkung bewerten und gegebenenfalls zurücknehmen. Reduziere diesen Modus nicht auf eine Liste manueller Freigabevorschläge.
Unterscheide begrenzte Parameteranpassung von zulässiger selbstständiger Plan-/Regelkomposition. Implementiere kontrollierte Modellzulassung, Änderungsgrenzen, schrittweise Ausweitung und einen eindeutig sichtbaren aktiven Plan. Pause, Geräte-Ausschluss und manuelle Vorgabe müssen sofort wirken. Modell-, Nachrichten- oder UI-Ausfall beendet nicht die letzte gültige Mindestfunktion. Eine Rücknahme überschreibt keine inzwischen erfolgte Nutzeränderung. Beweise den vollständigen Ablauf einschließlich negativer Wirkung und Rücknahme an einem nachvollziehbaren Testsystem mit echten Executor-Rückmeldungen aus dem Emulator. Vorhandene ausdrücklich freigegebene reale Versuche ergänzen die Abnahme und werden als solche getrennt dokumentiert.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-23.md. Private Rohdaten gehören nur nach .local/evidence/AP-23/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
