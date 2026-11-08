# AP-06 Befehle Prioritäten und Bestätigung

Voraussetzungen: AP-03, AP-04.

## Verbindliche Ergebnisse

- Einziger kontrollierter Geräte-Schreibpfad mit Prioritätsentscheidung
- Persistente Fristen, Budgets, Idempotenz und Fehlerisolierung

## Abnahme

- Ein Einzelgerätefehler oder fehlender Raum-Audit blockiert keine unabhängige bestätigte Funktion.
- Eigene Übernahmeeffekte werden nicht als Handwunsch gelernt; alte Antworten und Befehle werden abgelehnt.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-06 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere Arbiter, Executor und das persistente Auftragsjournal. Eingänge aus Regeln, Admin, berechtigter Fernbedienung und späterem Lernen nutzen denselben validierten Weg. Prüfe unmittelbar vor Ausführung Konfiguration, aktuellen menschlichen Vorrang, Geräteidentität, Frist und Zuständigkeit.
Unterscheide Versandannahme, bestätigten Gerätewert und beobachtete Wirkung. Behandle Duplikate, verspätete Antworten, Quellenwechsel, lokale Limits und unsichere Übernahme ohne blinde Wiederholung. Halte Sperren und Budgets über Neustarts, aber begrenze ihren Umfang. Ein vorübergehend fehlgeschlagener lesender Autoritätscheck darf nicht als endgültig gescheiterter Geräte-Audit hängen bleiben. Eigene Zwischenwerte während einer Profilübertragung werden nur anhand positiver Zuordnung als solche behandelt. Baue Regressionen für konkurrierende Handbedienung, mehrere verzögerte Aktoren einer Gruppe, Zustandswechsel während der Warteschlange und abgeschaltete optionalen Quellen. Beschreibe die erlaubte automatische Erholung mit konkreten Nachweisen; keine pauschale Entsperrung oder globale AUS-Aktion.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-06.md. Private Rohdaten gehören nur nach .local/evidence/AP-06/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
