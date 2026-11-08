# AP-27 Produktabnahme und Betriebsübergabe

Voraussetzungen: AP-24, AP-25, AP-26.

## Verbindliche Ergebnisse

- Zusammenhängender Abschlussbericht und korrekter Paketstatus
- Tatsächliche Repository-URL, Version, Installation, Betrieb und offene Voraussetzungen

## Abnahme

- Der zentrale Produktumfang einschließlich voller Automatisierung und Hersteller-SDK ist tatsächlich implementiert und integriert.
- Offene externe/hardwarebezogene Prüfungen bleiben von bestandener Softwareabnahme unterscheidbar.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-27 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Führe die Gesamtprüfung der Produktziele, aller APs und der verbindlichen Szenarien zusammen. Lies die Ergebnisse kritisch gegen tatsächlichen Quellstand, veröffentlichtes Artefakt, Controller-Installation und UI-Bedienung. Prüfe insbesondere, dass vollständige Automatisierung einen echten geschlossenen Ablauf besitzt, Herstellererweiterung ohne Fachregeländerung funktioniert und alle Kanäle optional bleiben.
Korrigiere noch offene implementierbare Mängel und führe die dazu passenden Prüfungen erneut aus. Kennzeichne fehlende reale Geräte, Konto- oder Katalogfreigaben konkret und behaupte keine erfolgreiche Liveprüfung. Erstelle eine Betriebsübergabe mit der tatsächlichen Repository-URL, Version, Einrichtung, Normalbetrieb, Diagnose, Lernfreigaben, Stopp/Rücknahme, Update und Datenaufbewahrung. Dokumentiere die Grenzen gemessener Energieeffekte. Bringe das Manifest auf den echten Endstand, sichere bereinigte öffentliche Belege und veröffentliche den abschließend geprüften Stand im neuen Repository. Kein leeres Gerüst oder bloßer Plan erfüllt diesen Abschluss.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-27.md. Private Rohdaten gehören nur nach .local/evidence/AP-27/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
