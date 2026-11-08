# AP-19 Berechtigte Bedienung und optionale Rückkanäle

Voraussetzungen: AP-05, AP-06, AP-18.

## Verbindliche Ergebnisse

- Einheitliches Bedienprotokoll für Admin und optionale Clients
- Optionaler berechtigter Telegram-Rückkanal

## Abnahme

- Ein veralteter oder doppelt übermittelter Bedienauftrag wird nicht erneut ausgeführt.
- Berechtigungen sind auf Geräte/Funktionen begrenzt; ein Nachrichtentext öffnet keine freie Datenpunktschnittstelle.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-19 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere ein gemeinsames Bedienprotokoll mit Identität, Funktionsumfang, Auftrags-ID, Frist, erwarteter Revision und verständlicher Antwort. Die Admin-Oberfläche und optionale Clients wie Sprachassistenten nutzen denselben Arbiter. Es gibt keinen privilegierten zweiten Geräteschreiber für KI oder Bots.
Ergänze optional Telegram für Status, befristete Vorgaben, Pause und kontrollierte Wiederaufnahme. Empfänger-/Benutzerzuordnung und Rollen werden ausdrücklich eingerichtet. Neue oder weitergeleitete Nachrichten, Gruppen, alte Buttons und Replay dürfen keine fremde Geräteaktion auslösen. Eine Freigabe erfordert die tatsächlichen fachlichen Nachweise und hebt keine Cloud-Sperre durch Wunschdenken auf. E-Mail und Pushover bleiben zunächst Meldungskanäle, kein ungeprüfter Fernsteuerweg. Implementiere Client-Verträge für spätere optionale Assistenten ohne Pflicht zu einem bestimmten Produkt. Prüfe Handbedienung während automatisch erzeugter Pläne und den sofortigen Abbruch widerrufener Aufträge.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-19.md. Private Rohdaten gehören nur nach .local/evidence/AP-19/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
