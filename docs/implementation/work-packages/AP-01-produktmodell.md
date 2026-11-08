# AP-01 Produktmodell und konfigurierbare Anforderungen

Voraussetzungen: AP-00.

## Verbindliche Ergebnisse

- Produktanforderungen und klarer Funktionskatalog
- Drei anwendungsneutrale Referenzkonfigurationen und vollständige Betriebsarten

## Abnahme

- Wohnung, Aquarium und Luftqualitätsbereich lassen sich ohne fest codierte Person oder Poolfeld beschreiben.
- Jede Anforderung hat einen überprüfbaren Abnahmefall; alle fünf Lernmodi bleiben im Umfang.

## Konkreter Ausführungsprompt

```text
Lies zuerst docs/implementation/COMMON.md und die dort genannten gemeinsamen Produktdokumente. Bearbeite AP-01 vollständig. Prüfe den tatsächlichen Ausgangsstand und die implementierten Abhängigkeiten. 

Überführe PROJECT.md in ein implementierbares Produktmodell. Definiere Geräte, Fähigkeiten, Räume, frei benannte Anlagen, Funktionsinstanzen, Kontexte, Ziele, Betriebsgrenzen, Konflikte und Bedienvorrang. Der Nutzer muss sowohl einfache Zeitsteuerung als auch mehrere verknüpfte Anforderungen konfigurieren können. Ein Begriff wie Pumpe darf nur eine nutzerzugeordnete semantische Funktion sein.
Beschreibe drei vollständige Beispiele: Wohnung mit Klima und Bewegungslight, Anlage mit unverzichtbarer Umwälzung und Tagesbeleuchtung sowie Luftqualitätsbereich mit einem unterstützten Luftreiniger. Lege klassische Betriebsarten, Dauerbetrieb, bedarfsgeregelten Betrieb, Wartung und alle fünf Lernmodi fest. Übersetze jedes Ziel in Akzeptanzfälle und identifiziere fehlende Gerätefähigkeiten ausdrücklich. Plane den ersten nutzbaren Durchstich so, dass er im Admin eingerichtet, über echte ioBroker-Schnittstellen ausgeführt und erklärt werden kann. Dokumentiere, welche Funktionen Beta-Kern und welche gerätespezifische Erweiterungen sind; die volle Automatisierung darf dabei nicht aus dem Kernziel verschwinden.

Führe die zu diesem AP gehörenden Prüfungen aus, integriere das Ergebnis in das Produkt und aktualisiere docs/implementation/work-packages.json mit getrenntem Implementierungs- und Prüfstatus. Schreibe eine bereinigte Zusammenfassung nach docs/verification/AP-01.md. Private Rohdaten gehören nur nach .local/evidence/AP-01/. Fahre anschließend mit dem nächsten ausführbaren AP fort.
```

## Nachweise und Fortsetzung

Die Abnahme benötigt die oben genannten funktionalen Belege. Fremde Änderungen und zwischenzeitliche Handbedienung bleiben erhalten. Wiederaufnahme erfolgt aus dem Manifest im neuen Repository; dieses ursprüngliche Planungspaket wird nicht als zweites Fortschrittsjournal gepflegt.
