# AP-12 Philips Air Integration

Voraussetzungen: AP-03, AP-06, AP-08.

## Verbindliche Ergebnisse

- Modellabhängige Luftreiniger- und Lüfterfähigkeiten
- Getrennte Lese-/Schreibunterstützung und Telemetriezuordnung

## Abnahme

- Ein Luftreiniger wird nicht automatisch wie eine Klimaanlage mit Temperaturregelung behandelt.
- Unbekannte Betriebs-/Statuscodes und nicht unterstützte Timer bleiben gesperrt oder lesend.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-12 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Implementiere Philips Air über die vorhandene ioBroker-Anbindung mit ausdrücklicher Modell- und Protokollmatrix. Unterscheide Schalten, Lüfterstufe, Betriebsmodus, verfügbare Luftqualität, Filterzustand und andere tatsächlich angebotene Funktionen. Eine Fähigkeit wird erst nach Zuordnung von Typ, Einheit, Wertebereich und Rückmeldung schreibbar.
Übernehme keine Statuscode- oder Timerannahme von einem Modell auf ein anderes. Prüfe Hersteller- und Treiberdokumentation und füge passende aufgezeichnete synthetische Fixtures hinzu. Behandle fehlerhafte oder unvollständige Luftqualitätswerte als unbekannt und erfinde keine gesundheitlichen Grenzwerte. Die Fachregeln erhalten normalisierte Fähigkeiten, keine Rohcodes. Implementiere Vertragsprüfungen für Moduswechsel, unbekannte Codes, Zeitüberschreitung, Wiederverbindung und reine Lesefunktionen. Wenn reale Hardware fehlt, liefere einen funktionsfähigen Integrationspfad mit klarer Vertragsabnahme und einem offenen präzisen Hardwareprüfplan, statt das komplette Herstellerportfolio als geprüft auszugeben.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-12.md. Private Rohdaten gehören nur nach .local/evidence/AP-12/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Reale Hardwareprüfung separat ausweisen. Emulator- und Vertragstests bleiben auch ohne Hardware ausführbar.

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
