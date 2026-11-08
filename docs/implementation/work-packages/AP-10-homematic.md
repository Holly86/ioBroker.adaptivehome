# AP-10 Homematic und Homematic IP Integration

Voraussetzungen: AP-03, AP-06, AP-08.

## Verbindliche Ergebnisse

- Getrennte Anbindungsprofile für Cloud Access Point und CCU
- Fähigkeitsmatrix für Sollwerte, Gruppen, Fenster, Handbedienung und native Programme

## Abnahme

- Keine Änderungen installierter Fremdadapterdateien sind Voraussetzung einer Standardinstallation.
- Native Programme, Fristen und manueller Vorrang werden nur bei nachgewiesener Unterstützung verwendet.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-10 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere Homematic mit getrennten Integrationsprofilen für Cloud Access Point und CCU-Anbindung. Ermittle die dokumentierten Schnittstellen der gewählten stabilen Geräteadapter. Fehlende Funktionen werden als Fähigkeitslücke ausgewiesen oder über eine ordentliche versionierte Erweiterung ergänzt; keine private Änderung von node_modules übernehmen.
Unterstütze passende Thermostat-, Gruppen-, Fenster-, Batterie- und Erreichbarkeitswerte. Die Thermostate regeln ihre Ventile selbst, soweit dies ihr Gerätebetrieb ist. Prüfe native Zeitprofile, Ablauf, tatsächliche Übernahme, eigene Zwischenwerte und Handwünsche getrennt. Eine Cloudannahme ist keine Bestätigung aller Gruppenmitglieder. Behalte laufende native Mindestfunktionen bei Quellen- oder Controllerausfall. Lokale Quoten sind nicht als Herstellerquoten zu behaupten. Baue Tests für mehrere verzögert bestätigende Thermostate, kurz fehlende Autorität, Profilidentitätswechsel, Sperrzeiten und Fenster. Führe nur die real möglichen, freigegebenen Geräteprüfungen durch und dokumentiere nicht verfügbare Fähigkeiten offen.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-10.md. Private Rohdaten gehören nur nach .local/evidence/AP-10/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Reale Hardwareprüfung separat ausweisen. Emulator- und Vertragstests bleiben auch ohne Hardware ausführbar.

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
