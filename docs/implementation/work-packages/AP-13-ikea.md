# AP-13 Optionale IKEA Anbindungen

Voraussetzungen: AP-03, AP-06, AP-08.

## Verbindliche Ergebnisse

- Getrennte optionale Pfade für passende Gateway-/Protokollvarianten
- Eindeutige Gerätezuordnung ohne zweite konkurrierende Bindung

## Abnahme

- Eine Installation ohne IKEA benötigt keinen zusätzlichen Adapter oder Pflichtdialog.
- Tradfri-, Matter- und andere Anbindungsvarianten werden nicht pauschal gleichgesetzt.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-13 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Ergänze die optionale IKEA-Unterstützung anhand konkret verfügbarer öffentlicher Anbindungen. Prüfe getrennt den älteren Tradfri-Gatewayweg, passende Matter-Geräte oder Gateways und gegebenenfalls eine bereits eingerichtete ZigBee-Anbindung. Versprich keine Dirigera-Unterstützung ohne einen tatsächlich geprüften Weg.
Ordne nur die nachgewiesenen Schalt-, Dimm-, Kontakt-, Bewegungs- oder weiteren Fähigkeiten zu. Ein über Hue oder ZigBee bereits gebundenes Gerät darf nicht durch erneute Erkennung doppelt gesteuert werden. Ergänze Konfigurationsassistenz und Kompatibilitätsmatrix. Die bereits implementierten Licht- und Betriebsregeln müssen unverändert mit diesen Fähigkeiten arbeiten. Führe Vertragstests und die verfügbare reale Prüfung aus. Markiere fehlende Geräteprüfungen einzeln; halte die Integration vollständig optional und verhindere jede globale Bereitschaftssperre bei nicht installiertem IKEA-Backend.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-13.md. Private Rohdaten gehören nur nach .local/evidence/AP-13/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Reale Hardwareprüfung separat ausweisen. Emulator- und Vertragstests bleiben auch ohne Hardware ausführbar.

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
