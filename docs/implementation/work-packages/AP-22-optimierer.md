# AP-22 Adaptive Planung und Zielkonflikte

Voraussetzungen: AP-20, AP-15, AP-16, AP-17.

## Verbindliche Ergebnisse

- Lokaler Optimierer für freigegebene Parameter und Regelkombinationen
- Baselinevergleich, Kandidatenbewertung und erklärte Pläne

## Abnahme

- Der Optimierer kann ohne externes Sprachmodell eine ausführbare Verbesserung erzeugen.
- Harte Mindestfunktionen werden nicht zugunsten eines besseren gewichteten Energieergebnisses verletzt.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-22 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Implementiere die adaptive Planung über den lokalen Modellen. Erzeuge Kandidaten aus den tatsächlich freigegebenen Parametern und endlichen Regelbausteinen. Unterstütze Ziele wie Komfort, Luftqualität, Betriebskontinuität, Schalthäufigkeit und geeignete gemessene Energie. Harte Bedingungen werden vor jeder weichen Optimierung geprüft.
Plane zeitlich zusammenhängende Abläufe statt einzelner widersprüchlicher Schaltimpulse. Berücksichtige Gerätefähigkeit, Prognoseunsicherheit, Vorlauf, technische Grenzen, Konfigurationswechsel und das Fehlen optionaler Daten. Vergleiche Kandidaten mit einer klaren Baseline und gib Gründe sowie erwartete Wirkung aus. Implementiere eine konservative Behandlung dünner Daten und keine unfreigegebenen Probeschaltungen zur Erkundung. Teste Wohnung, Dauerpumpe mit Tagesbeleuchtung und Luftqualitätsbereich. Ein externer KI-Anbieter darf zusätzliche Kandidaten liefern, ist aber keine zwingende Abhängigkeit. Der resultierende Plan muss bereits durch den realen Arbiter/Executor-Vertrag validiert werden können.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-22.md. Private Rohdaten gehören nur nach .local/evidence/AP-22/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
