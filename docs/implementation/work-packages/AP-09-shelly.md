# AP-09 Shelly Integration

Voraussetzungen: AP-03, AP-06, AP-08.

## Verbindliche Ergebnisse

- Versionierte Shelly-Erkennung und Zuordnung über vorhandene Anbindung
- Schalten, Dimmen und verfügbare Messfähigkeiten mit Prüfmatrix

## Abnahme

- Eine Relaispumpe und eine Leuchte verwenden dieselbe Herstellerintegration mit unterschiedlichen Nutzerregeln.
- Unbekannte Gerätefunktionen und falsche Geräteidentität lösen keinen Schreibzugriff aus.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-09 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Implementiere Shelly als erste vollständige Herstellerintegration. Verwende bevorzugt die vorhandene Shelly-Adapteranbindung. Unterscheide Gerätegenerationen und tatsächlich angebotene Datenpunkte; keine einzelne private REST-Adresse als Herstellerunterstützung ausgeben.
Normalisiere Schalten, Dimmen, Farbe, Energie und Sensoren nur soweit vorhanden. Trenne Soll- und Rückmeldepunkt, Handbedienung, Onlinezustand und echte Messzeit. Mehrkanalgeräte dürfen nicht versehentlich den falschen Ausgang bedienen. Dokumentiere unterstützte Adapter-/Geräteversionen und Einschränkungen. Direkte Protokollzugriffe sind nur als klar begründeter, separater und modellgeprüfter Pfad zulässig, nicht als unbemerkter zweiter Schreiber. Führe gemeinsame Vertragstests und Controller-Integration aus, prüfe Ablehnung, Zeitüberschreitung, Neuverbindung und unveränderte Rückmeldungen. Reale Geräteprüfungen gemäß vorhandener Freigabe dokumentieren; fehlende Hardware wird nicht durch eine fingierte ON-Bestätigung ersetzt.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-09.md. Private Rohdaten gehören nur nach .local/evidence/AP-09/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Reale Hardwareprüfung separat ausweisen. Emulator- und Vertragstests bleiben auch ohne Hardware ausführbar.

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
