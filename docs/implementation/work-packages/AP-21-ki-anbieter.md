# AP-21 Optionale KI und lokale Modellanbieter

Voraussetzungen: AP-04, AP-06, AP-08, AP-20.

## Verbindliche Ergebnisse

- Austauschbare lokale und Cloud-Anbieter mit Fähigkeiten und Budgets
- Strukturierte Absichts-/Vorschlagserzeugung ohne freien Aktorzugriff

## Abnahme

- Ohne externen Anbieter bleibt der lokale Lern-/Automatikweg funktionsfähig.
- Ungültige, manipulierte oder überbudgetierte Modellantworten werden nicht ausgeführt.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-21 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere die optionale Anbieter-Schnittstelle für lokale Modelle, Cloudmodelle und gegebenenfalls einen externen Assistenten. Fähigkeiten, Datenweitergabe, Kosten, Zeitgrenzen, Verfügbarkeit und aktivierter Nutzerumfang werden ausdrücklich konfiguriert. Setze kein bestimmtes Abo, Konto, Modell oder einen lokalen Modellserver voraus.
Modellantworten liefern ausschließlich validierte Absichten, Erklärungen oder Kandidaten in der zugelassenen Grammatik. Keine freien Skripte oder frei gewählten ioBroker-Schreibziele. Externe Texte und Antworten können die Nutzerfreigabe nicht erweitern. Implementiere Abbruch, Wiederholungsgrenzen, Kostenreservierung und eine sichere Fortsetzung mit der letzten gültigen klassischen Regel bei Anbieterausfall. Ein deterministischer Testanbieter prüft die Verträge; mindestens ein realer Anbieterpfad wird soweit mit autorisierten Zugangsdaten möglich geprüft. Fehlende Zugangsdaten und nicht durchgeführte bezahlte Aufrufe werden exakt ausgewiesen. Normale Nutzerbefehle und körperliche Grundfunktionen warten nicht auf dieses Modul.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-21.md. Private Rohdaten gehören nur nach .local/evidence/AP-21/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
