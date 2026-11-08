# AP-02 Adapterlaufzeit und unabhängige Ausführung

Voraussetzungen: AP-00, AP-01.

## Verbindliche Ergebnisse

- ioBroker-Lebenszyklus, gemeinsame Admin-Anbindung und getrennte Funktionslaufzeiten
- Geprüfter Start-, Stop- und Wiederverbindungsablauf

## Abnahme

- Ein ausgefallener Lernprozess oder eine fehlerhafte Funktionsinstanz beendet keine unabhängige Steuerung.
- Betrieb funktioniert in einem frischen ioBroker ohne Node-RED; Neustart schaltet nicht aus einem alten Ereignis ein.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-02 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Implementiere das Laufzeitgerüst als richtiges ioBroker-Adapterpaket. Entscheide anhand eines kleinen nachweisbaren Versuchs, wie unabhängige Funktionsinstanzen und Lernarbeit getrennt laufen, während der Nutzer eine gemeinsame Admin-Ansicht erhält. Eine UI- oder Koordinatorunterbrechung darf nicht zum Pflichtstopp aller Schaltpfade führen.
Implementiere ready, stateChange, objectChange, message und unload mit gezielten Subscriptions, sauberem Abmelden und begrenzten Hintergrundarbeiten. Registriere unterstützte Fähigkeiten, Zustand, Bereitschaft und Fehler pro Instanz. Rehydration stellt gültige Konfiguration und bestätigte Zuständigkeit wieder her, spielt aber keine alten Gerätebefehle oder Timer ungeprüft ab. Begrenze CPU-, Speicher- und Warteschlangenarbeit. Verwende eine nachvollziehbare Uhrabstraktion für Zeitzonen-, Sprung- und Neustarttests. Prüfe Installation und Lebenszyklus an einem echten Test-js-controller. Halte Verbindungskonfiguration, Oberfläche und späteren Fachkern so getrennt, dass ein weiterer Hersteller keine Änderung dieses Lebenszyklus benötigt.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-02.md. Private Rohdaten gehören nur nach .local/evidence/AP-02/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
