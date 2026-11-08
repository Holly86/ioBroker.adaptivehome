# AP-14 Generische Zuordnung und Hersteller SDK

Voraussetzungen: AP-03, AP-04, AP-06, AP-09, AP-11.

## Verbindliche Ergebnisse

- Dokumentierte SDK-/Manifest-Schnittstelle und Beitragsschablone
- Zusätzlicher Beispielhersteller und generische Datenpunkt-Zuordnung

## Abnahme

- Ein neuer Beispielhersteller wird ergänzt, ohne bestehende Fachregeln umzuschreiben.
- Ungültige Plugin-Versionen und unzulässige Datenpunktzugriffe werden zurückgewiesen.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-14 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Vervollständige die Herstellererweiterung zu einem benutzbaren SDK mit Manifest, Typen, Validierung, Beispielen und gemeinsamem Testaufruf. Erzeuge eine kleine Beitragsschablone oder ein Entwicklungswerkzeug für neue Integrationen. Erkläre jede Pflichtfunktion einschließlich Identität, Einheiten, Rückmeldung, Limits und unterstützter Backend-Versionen.
Implementiere die generische manuelle Zuordnung vorhandener ioBroker-Datenpunkte für weitere Hersteller. Sie hat dieselben Prüfungen und denselben Executor wie eingebaute Profile. Installiere nur ausdrücklich konfigurierte vertrauenswürdige Erweiterungen; keine Plugins aus Modelltexten oder beliebigen URLs ausführen. Beweise die Erweiterbarkeit mit einem zusätzlichen erfundenen Hersteller, dessen Schalter, Dimmer und Sensoren durch die vorhandenen Licht-/Anlagenregeln genutzt werden. Bestehende Fachmodule bleiben unverändert. Dokumentiere Versionierung und Migrationsregeln und prüfe inkompatible Schnittstellen, doppelte Geräteidentitäten und fehlende Bestätigungsfähigkeiten.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-14.md. Private Rohdaten gehören nur nach .local/evidence/AP-14/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
