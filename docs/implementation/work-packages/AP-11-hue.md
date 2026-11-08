# AP-11 Philips Hue Integration

Voraussetzungen: AP-03, AP-06, AP-08.

## Verbindliche Ergebnisse

- Hue-Geräte-, Gruppen- und Sensorschnittstelle
- Normalisierte Licht-, Helligkeits- und Bewegungssignale

## Abnahme

- Bewegungs- und Lichtsensor eines physischen Geräts werden korrekt verbunden.
- Manuelles Dimmen und Einschalten werden nicht als automatische Zuständigkeit übernommen.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-11 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten.

Implementiere Philips Hue über die gewählte bestehende ioBroker-Anbindung. Trenne physisches Gerät, Gruppe, Szene, Bewegung, Helligkeit und Bedienereignis. Normalisiere die dokumentierte Einheit der Helligkeit und die Zeitstempel; unterschiedliche Bridge-/Anbindungsvarianten benötigen eigene geprüfte Merkmale.
Gruppen dürfen keine vom Nutzer ausgeschlossenen zusätzlichen Leuchten mitschalten. Verknüpfe Bewegung und Helligkeit anhand belastbarer Identität, nicht bloß ähnlich benannter Datenpunkte. Erhalte manuellen Vorrang auch bei Dimmen ohne Wechsel des Ein-Zustands. Prüfe erreichbare unveränderte Sensorwerte, leicht vorausliegende Ereigniszeiten, schnelle Folgen und Wiederanlauf. Alte Bewegung darf keinen Neustart-Schaltbefehl erzeugen; ein zunächst noch nicht zulässiger neuer Zeitstempel darf nicht vorzeitig verbraucht werden. Implementiere den gemeinsamen Herstellervertrag und führe gezielte Hardwarechecks durch, soweit vorhanden. Halte Modell-/Adapterstatus und reale Prüftiefe in der Kompatibilitätsmatrix fest.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-11.md. Private Rohdaten gehören nur nach .local/evidence/AP-11/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Reale Hardwareprüfung separat ausweisen. Emulator- und Vertragstests bleiben auch ohne Hardware ausführbar.

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
