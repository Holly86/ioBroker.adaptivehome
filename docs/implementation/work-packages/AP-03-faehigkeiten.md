# AP-03 Gerätefähigkeiten und Integrationsverträge

Voraussetzungen: AP-01, AP-02.

## Verbindliche Ergebnisse

- Versionierte TypeScript-Typen und Laufzeitvalidierung
- Integrationsregister, stabile Bindungen und gemeinsamer Vertragstest

## Abnahme

- Schalten, Dimmen, Klima, Luft, Sensoren und Energie lassen sich ohne Herstellerbedingungen in Fachregeln verwenden.
- Doppelte physische Geräte, falsche Einheiten und unbestätigbare Schreibpfade werden erkannt.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-03 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere die fachlichen Verträge aus DATA-CONTRACTS.md. Trenne rohe Herstellerwerte, normalisierte Fähigkeiten und die vom Nutzer zugewiesene Funktion. Nutze passende vorhandene ioBroker-Typerkennung, aber bestätige Identität, Einheiten und Schreibbarkeit gesondert; ein Rollenname allein ist keine Schaltfreigabe.
Baue ein versioniertes Integrationsregister mit Erkennung, Abonnement, Normalisierung, Befehl, Rückmeldung, Qualität, Grenzen und beschriebener Gerätefähigkeit. Definiere Erweiterungspunkte für weitere Fähigkeiten und Integrationen. Ein Datenpunkt kann nur in einem koordinierten physischen Befehlspfad aktiv sein. Erlaube explizite manuelle Zuordnung, ohne falsche automatische Erkennung fortzuschreiben. Erstelle ein gemeinsames Vertragstestpaket mit Simulation fehlender Werte, identischer Rückmeldungen, Wiederverbindung, fehlerhafter Einheit und eingeschränkter Gerätefunktionen. Prüfe die Grenzen zwischen Plugin und Kern durch einen minimalen fremden Beispielhersteller. Die Regeln kennen weder dessen Namen noch seine Datenpunktstruktur.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-03.md. Private Rohdaten gehören nur nach .local/evidence/AP-03/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
