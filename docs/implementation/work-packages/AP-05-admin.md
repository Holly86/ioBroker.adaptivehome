# AP-05 Admin Oberfläche und Einrichtungsassistent

Voraussetzungen: AP-03, AP-04.

## Verbindliche Ergebnisse

- Deutsche und englische Einrichtung direkt im ioBroker-Admin
- Gemeinsame Übersicht, dynamische Formulare und nachvollziehbare Livezustände

## Abnahme

- Eine unvorbereitete Installation kann die drei Referenzfälle ohne Quellcodebearbeitung einrichten.
- Nicht konfigurierte Hersteller und optionale Module erzwingen keine Eingaben und bleiben übersichtlich.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-05 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Baue die gemeinsame Admin-Oberfläche mit passenden ioBroker-Komponenten und einem verständlichen Einrichtungsassistenten. Führe durch Anbindungen, Geräteerkennung, Bestätigung der Funktion, Zuordnung zu Räumen/Anlagen, Regeln, Betriebsgrenzen und optionale Kanäle. Zeige nur Einstellungen tatsächlich ausgewählter Fähigkeiten; kein fester Pool-Tab.
Implementiere bearbeitbare Sollwerte, Zeitpläne, Lichtschwellen, Nachläufe, Dauerbetrieb und Ausschlüsse. Trenne technische Verbindungen von Alltagseinstellungen. Die Übersicht zeigt gewünschtes Ziel, tatsächlichen Gerätezustand, Messwert, Begründung, Datenalter, nächste Aktion und gegebenenfalls eine lokale Einschränkung. Die Lernansicht enthält alle fünf Modi und die eingerichtete Freigabe. Implementiere Vorschau/Validierung, fehlgeschlagene Speicherung und konkurrierende Änderung verständlich. Prüfe echte Browserbedienung, schmale Darstellung, Tastaturbedienung, übersetzte Texte und die Konfiguration ohne vollständige Herstellerinstallation. Die Oberfläche bleibt im Admin; eine zusätzliche Pflicht-Webanwendung wird nicht eingeführt.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-05.md. Private Rohdaten gehören nur nach .local/evidence/AP-05/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
