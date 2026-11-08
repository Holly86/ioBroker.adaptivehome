# AP-18 Optionale Benachrichtigungskanäle

Voraussetzungen: AP-04, AP-06, AP-08.

## Verbindliche Ergebnisse

- Telegram-, Pushover- und E-Mail-Anbindung über konfigurierte Instanzen
- Störungsbündelung, Empfängerrouting, Ruhezeiten und Zustellnachweise

## Abnahme

- Alle Kanäle können deaktiviert sein, während die Steuerung vollständig funktioniert.
- Nur konfigurierte Empfänger erhalten passende Meldungen; Wiederanlauf erzeugt keine Alarmflut.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-18 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere ein gemeinsames Incident-Modell und die optionalen Ausgänge Telegram, Pushover und E-Mail. Nutze vorhandene geeignete ioBroker-Kanaladapter, wo möglich. Empfänger werden ausdrücklich zugeordnet; keine beliebige Gruppe automatisch aus fremder Konfiguration übernehmen.
Konfigurierbar sind Themen, Bereiche, Schweregrade, Ruhezeiten, Entwarnung und begrenzte Wiederholung. Derselbe Störungsfall wird zusammengefasst; ein kurzer erwarteter Übergang wird nicht als schwerer Gesamtausfall gemeldet. Trenne Versandauftrag, Annahme durch den Kanal und tatsächlichen Zustellnachweis. Kanalausfälle blockieren keine Aktorsteuerung; ein alternativer eingerichteter Weg kann nach Nutzerregel genutzt werden. Zugangsdaten gehören in den vorgesehenen geschützten Speicher, nicht in Diagnosen oder Export. Verwende Testdoubles für automatisierte Tests und sende reale Testnachrichten nur an ausdrücklich dafür bestimmte eigene Empfänger. Prüfe Duplikate, Teilfehler, Wiederanlauf, Empfängerwechsel und abgeschaltete Kanäle.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-18.md. Private Rohdaten gehören nur nach .local/evidence/AP-18/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
