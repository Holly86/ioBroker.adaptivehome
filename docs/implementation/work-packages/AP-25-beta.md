# AP-25 Dokumentation Paket und öffentliche Beta

Voraussetzungen: AP-00, AP-05, AP-14, AP-18, AP-23, AP-24.

## Verbindliche Ergebnisse

- Installierbares geprüftes Paket und echte öffentliche GitHub-Beta
- Einrichtung, Hersteller-SDK, Betrieb, Updates und Kompatibilitätsmatrix

## Abnahme

- Das veröffentlichte Paket lässt sich im frischen Testcontroller ohne private Dateien installieren und bedienen.
- GitHub-Beta, npm und ioBroker-Katalogstatus werden korrekt getrennt angegeben.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-25 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Erstelle eine vollständige deutsche und englische öffentliche Dokumentation mit Einrichtung, den drei lauffähigen Referenzfällen, Lernmodi, optionalen Kanälen, Erweiterungsanleitung und den tatsächlichen Geräteprüfungen. Die README muss den Nutzen ohne privates Vorwissen erklären. Vor der ersten Beta-Veröffentlichung müssen alle drei verpflichtenden Referenzfälle über den Admin geprüft sein; AP-26 erweitert diese Prüfung anschließend um andere Installationsvarianten und den optionalen privaten Pilot.
Baue ein installierbares Paket, prüfe dessen tatsächlichen Inhalt und installiere genau dieses Artefakt in einem frischen ioBroker-Testsystem. Prüfe Abhängigkeiten, Metadaten, Lizenzangaben, Secret-/Datenfreiheit und öffentliche Belege. Veröffentliche den geprüften Quellstand und eine klar bezeichnete GitHub-Beta mit Changelog und Rückweg im autorisierten neuen Repository. Prüfe aktuelle ioBroker-Paket-/Repositoryanforderungen. npm-Veröffentlichung und Aufnahme in latest/stable werden vorbereitet und nur mit tatsächlich vorhandenen passenden Rechten/Freigaben ausgeführt; fremde Katalogaufnahme oder externe Antworten nicht behaupten. Fehlende npm-Rechte lassen ein korrekt geprüftes GitHub-Beta-Artefakt nicht verschwinden, bleiben aber als eigener externer Schritt sichtbar.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-25.md. Private Rohdaten gehören nur nach .local/evidence/AP-25/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
