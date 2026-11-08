# AP-07 Optionale Kontextquellen

Voraussetzungen: AP-03, AP-06.

## Verbindliche Ergebnisse

- Wetter-, Kalender-, Anwesenheits-, Lichtnutzungs- und Energieverträge
- Qualität, Aktualität und konfigurierte Ersatzregeln je Quelle

## Abnahme

- Fehlender Kalender oder Wetteranbieter behauptet keine Abwesenheit und stoppt keine unabhängigen Anlagen.
- Anwesenheit ist nutzerdefiniert; Bewegung allein identifiziert keine Person.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-07 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere optionale Kontextanbieter über bestehende ioBroker-Daten oder klar abgegrenzte öffentliche Schnittstellen. Unterstütze Wetter, Kalender, Anwesenheit, Nutzungshinweise und Energie als unabhängige Quellen. Der Nutzer wählt Quelle und Bedeutung, nicht fest eingebaute Personennamen oder Kalendertitel.
Normalisiere Beobachtungszeit, Qualität, Vollständigkeit und Einheiten. Ein vollständiger letzter gültiger Datenstand kann nur innerhalb seiner dokumentierten Gültigkeit weiterverwendet werden. Behandle kurze Abwesenheitsbestätigungen ohne sofortige Unterversorgung; unbekannt bleibt unbekannt. Bewegungs- und Lichtsignale liefern positive Nutzungshinweise. Erlaube konfigurierbare Bestätigung gegen Haustierauslösung. Ein Feiertags- oder Schulkalender ist optional und installationsabhängig. Datenlücken wirken ausschließlich auf die zugehörige Entscheidung und deren definierte Mindestfunktion. Prüfe Quellenwechsel, Sommerzeit, unveränderte Werte, verspätete Daten und widersprüchliche Signale. Externe Texte werden nicht als Befehle interpretiert.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-07.md. Private Rohdaten gehören nur nach .local/evidence/AP-07/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
