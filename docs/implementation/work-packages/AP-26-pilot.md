# AP-26 Generalisierungsabnahme und optionaler privater Pilot

Voraussetzungen: AP-15, AP-16, AP-17, AP-23, AP-24, AP-25.

## Verbindliche Ergebnisse

- Gleiche öffentliche Software in drei verschieden aufgebauten Installationen
- Gesonderte reale Gerätebelege oder präziser offener Prüfplan

## Abnahme

- Andere Geräteanzahl, andere Datenpunktpräfixe, andere Räume und kein Pool funktionieren ohne Quellcodeänderung.
- Ein privater Pilot veröffentlicht keine Haushaltsdaten und erzeugt keinen zweiten Aktorschreiber.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-26 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Installiere dieselbe gebaute Beta in drei getrennten Konfigurationen: Wohnung mit Klima/Licht, frei benannte Anlage mit Dauerumwälzung/Tageslicht und ein Luftqualitätsbereich. Ändere auch Zeitzone, Geräteanzahl, Herstellerzusammenstellung und Datenpunktpräfixe. Prüfe die Konfiguration über den Admin statt versteckte Quelltextanpassungen.
Die Emulatorabnahme ist verpflichtend und bleibt als solche gekennzeichnet. Reale Geräte werden nur im tatsächlich autorisierten Umfang ergänzend genutzt. Eine private Bestandsinstallation wird zunächst lesend bzw. im Shadow-Vergleich eingebunden; übernimm keine pauschale Produktionsfreigabe aus öffentlichen Dokumenten. Vor Aktorübergabe müssen Zuständigkeit, native Mindestfunktion, letzte gültige Konfiguration und Rückweg konkret nachgewiesen sein. Stoppe zuerst den alten Schreiber und aktiviere dann den neuen. Keine gefährlichen Pumpen-/Tier-/Wassertests ohne passende Voraussetzungen. Eine fehlende private Hardwarefreigabe blockiert nicht die allgemeine Produktentwicklung; öffentliche Kompatibilitätsaussagen bleiben entsprechend begrenzt.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-26.md. Private Rohdaten gehören nur nach .local/evidence/AP-26/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Reale Hardwareprüfung separat ausweisen. Emulator- und Vertragstests bleiben auch ohne Hardware ausführbar.

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
