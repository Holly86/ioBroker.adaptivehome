# AP-16 Klima Heizung und Luftqualität

Voraussetzungen: AP-05, AP-06, AP-07, AP-08, AP-10, AP-12.

## Verbindliche Ergebnisse

- Konfigurierbare Klima- und Luftfunktionsinstanzen
- Native Mindestfunktion, Zeit-/Präsenzregeln und getrennte Wärmebereitstellung

## Abnahme

- Sollwerte, native Übernahme und Raumwirkung sind getrennt sichtbar; ein Teilfehler kühlt nicht durch globalen Regelstopp andere Räume aus.
- Luftqualität, Ruhezeiten und Lüftergrenzen sind nutzerdefiniert und modellabhängig ausführbar.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-16 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere Klima-/Heizfunktionen und Luftqualitätsfunktionen als getrennte auswählbare Module über dieselben Kernverträge. Für Heizung konfiguriert der Nutzer Basis, Komfort, Zeiten, Quellen, manuellen Vorrang und native Ablauf-/Ausfallmöglichkeiten. Vorhersage, Nutzungszeit und Kalender bleiben optional. Ein Thermostat regelt seine Ventile selbst; der Adapter steuert den freigegebenen Sollwert und überwacht die Wirkung.
Behandle eine kurze Abwesenheitsbestätigung, fehlende Wetterdaten, mehrere Thermostate und verzögerte Profilübernahme ohne pauschale Hausabsenkung. Stelle Wärmebedarf und vorhandene oder nur angenommene Wärmebereitstellung getrennt dar. Verändere Sensoroffsets nicht als verdeckte Leistungsnachregelung. Für Luftfunktionen werden Messgröße, Zielbereich, Lüfterstufen, Ruhezeiten, Hysterese und maximale Schalthäufigkeit eingerichtet. Schalte nur unterstützte Modi. Prüfe Fremdhandbedienung, Fenster, unsichere Sensoren, native Fristen, fehlende Anlageleistung und die korrekte Wiederaufnahme nach Störungen. Dokumentiere physische Grenzen, statt erreichte Raumtemperaturen aus Sollwertbestätigungen abzuleiten.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-16.md. Private Rohdaten gehören nur nach .local/evidence/AP-16/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
