# AP-20 Lokale Lernverfahren und Datengüte

Voraussetzungen: AP-04, AP-07, AP-08, AP-15, AP-16, AP-17.

## Verbindliche Ergebnisse

- Merkmalspipeline, lokale Modelle, Modellregister und zeitlich getrennte Bewertung
- Nutzungs-, Reaktions- und Betriebsbedarfsauswertung

## Abnahme

- Lücken und künftige Daten gelangen nicht als falsche Abwesenheit oder Trainingswissen in die Bewertung.
- Lernfehler lassen klassische Regeln weiterlaufen; dünne Daten erzeugen nachvollziehbar keine aktive Anpassung.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-20 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Implementiere eine lokale Lernbasis für Nutzungsmuster, thermische Reaktion und geeignete allgemeine Betriebsbedarfe. Definiere Merkmale und Modellfamilien passend zum jeweiligen Problem; ein universelles Textmodell ist keine Voraussetzung. Verwende echte Qualitätsmerkmale und beobachtete menschliche Korrekturen, ohne jedes manuelle Ereignis sofort als dauerhafte Präferenz zu übernehmen.
Trenne Training und Bewertung zeitlich und dokumentiere Datenabdeckung, vergleichbare Tage, Gaps, Baseline und Unsicherheit. Fehlende Bewegung beweist keine Nichtnutzung und Bewegung identifiziert keine Person. Modelle und Daten besitzen Versionen, Herkunft und begrenzte Aufbewahrung. Rechenarbeit läuft getrennt von zeitkritischer Steuerung. Baue Drift- und Datenbrucherkennung sowie einen kontrollierten Modellwechsel. Implementiere brauchbare Beobachtungs- und Vorschlagsansichten mit begründeten Ergebnissen. Prüfe auf synthetisch bekannten Mustern und realen freigegebenen Daten jeweils gesondert. Keine frei erfundenen Konfidenzen oder Einsparungszahlen in der Oberfläche anzeigen.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-20.md. Private Rohdaten gehören nur nach .local/evidence/AP-20/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
