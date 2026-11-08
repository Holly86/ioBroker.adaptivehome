# Adaptive Home Umsetzungspaket

Dieses öffentliche Planungspaket beschreibt die vollständige autonome Umsetzung eines allgemeinen ioBroker-Adapters. Alle 28 APs sind zunächst geplant; keine Produktfunktion gilt durch dieses Dokument als implementiert. Der ausführende Chat führt den tatsächlichen Fortschritt nach Übernahme im neuen Repository fort.

Lies [Produktauftrag](PROJECT.md), [gemeinsamen Auftrag](COMMON.md), [Architektur](ARCHITECTURE.md), [Datenverträge](DATA-CONTRACTS.md), [volle Automatisierung](AUTONOMY.md), [Abnahme](ACCEPTANCE.md) und [Quellen](SOURCES.md). Das [Manifest](work-packages.json) enthält Abhängigkeiten und getrennte Implementierungs-/Prüfstände.

## Konkrete Arbeitspakete

| Prompt | Ergebnisbereich | Voraussetzungen |
| --- | --- | --- |
| [AP-00](work-packages/AP-00-repository.md) | Öffentliches Repository und Entwicklungsbasis | keine |
| [AP-01](work-packages/AP-01-produktmodell.md) | Produktmodell und konfigurierbare Anforderungen | AP-00 |
| [AP-02](work-packages/AP-02-laufzeit.md) | Adapterlaufzeit und unabhängige Ausführung | AP-00, AP-01 |
| [AP-03](work-packages/AP-03-faehigkeiten.md) | Gerätefähigkeiten und Integrationsverträge | AP-01, AP-02 |
| [AP-04](work-packages/AP-04-konfiguration.md) | Konfiguration Zeitpläne und Migration | AP-03 |
| [AP-05](work-packages/AP-05-admin.md) | Admin Oberfläche und Einrichtungsassistent | AP-03, AP-04 |
| [AP-06](work-packages/AP-06-ausfuehrung.md) | Befehle Prioritäten und Bestätigung | AP-03, AP-04 |
| [AP-07](work-packages/AP-07-kontext.md) | Optionale Kontextquellen | AP-03, AP-06 |
| [AP-08](work-packages/AP-08-historie.md) | Beobachtungen Historie und Erklärungen | AP-03, AP-04 |
| [AP-09](work-packages/AP-09-shelly.md) | Shelly Integration | AP-03, AP-06, AP-08 |
| [AP-10](work-packages/AP-10-homematic.md) | Homematic und Homematic IP Integration | AP-03, AP-06, AP-08 |
| [AP-11](work-packages/AP-11-hue.md) | Philips Hue Integration | AP-03, AP-06, AP-08 |
| [AP-12](work-packages/AP-12-philips-air.md) | Philips Air Integration | AP-03, AP-06, AP-08 |
| [AP-13](work-packages/AP-13-ikea.md) | Optionale IKEA Anbindungen | AP-03, AP-06, AP-08 |
| [AP-14](work-packages/AP-14-erweiterungs-sdk.md) | Generische Zuordnung und Hersteller SDK | AP-03, AP-04, AP-06, AP-09, AP-11 |
| [AP-15](work-packages/AP-15-licht-regeln.md) | Allgemeine Licht und Schaltregeln | AP-05, AP-06, AP-07, AP-08, AP-09, AP-11 |
| [AP-16](work-packages/AP-16-klima-luft.md) | Klima Heizung und Luftqualität | AP-05, AP-06, AP-07, AP-08, AP-10, AP-12 |
| [AP-17](work-packages/AP-17-anlagen.md) | Allgemeine Anlagen Pumpen und Dauerbetrieb | AP-05, AP-06, AP-07, AP-08, AP-09 |
| [AP-18](work-packages/AP-18-benachrichtigungen.md) | Optionale Benachrichtigungskanäle | AP-04, AP-06, AP-08 |
| [AP-19](work-packages/AP-19-bedienung.md) | Berechtigte Bedienung und optionale Rückkanäle | AP-05, AP-06, AP-18 |
| [AP-20](work-packages/AP-20-lernen.md) | Lokale Lernverfahren und Datengüte | AP-04, AP-07, AP-08, AP-15, AP-16, AP-17 |
| [AP-21](work-packages/AP-21-ki-anbieter.md) | Optionale KI und lokale Modellanbieter | AP-04, AP-06, AP-08, AP-20 |
| [AP-22](work-packages/AP-22-optimierer.md) | Adaptive Planung und Zielkonflikte | AP-20, AP-15, AP-16, AP-17 |
| [AP-23](work-packages/AP-23-vollautomatik.md) | Geschlossene volle Automatisierung | AP-05, AP-06, AP-08, AP-19, AP-22 |
| [AP-24](work-packages/AP-24-zuverlaessigkeit.md) | Ausfälle Datenfehler und Gesamtsystemtests | AP-09, AP-10, AP-11, AP-12, AP-13, AP-14, AP-15, AP-16, AP-17, AP-18, AP-19, AP-20, AP-21, AP-22, AP-23 |
| [AP-25](work-packages/AP-25-beta.md) | Dokumentation Paket und öffentliche Beta | AP-00, AP-05, AP-14, AP-18, AP-23, AP-24 |
| [AP-26](work-packages/AP-26-pilot.md) | Generalisierungsabnahme und optionaler privater Pilot | AP-15, AP-16, AP-17, AP-23, AP-24, AP-25 |
| [AP-27](work-packages/AP-27-abschluss.md) | Produktabnahme und Betriebsübergabe | AP-24, AP-25, AP-26 |

## Ende zu Ende liefern

Zuerst entsteht ein eigenständiges öffentliches Repository mit frischem Adaptergerüst. Danach werden Geräteverträge, Konfiguration, Admin und der einzige Ausführungspfad implementiert. Herstelleranbindungen und allgemeine Funktionen folgen auf diesen Verträgen. Optionale Meldungen und Lernverfahren erweitern den funktionsfähigen klassischen Kern. AP-23 implementiert ausdrücklich volle Automatisierung, AP-24 bis AP-27 prüfen und veröffentlichen das integrierte Produkt.

Offene reale Geräteprüfungen bleiben in der Kompatibilitätsmatrix sichtbar. Sie rechtfertigen weder eine falsche Herstellerfreigabe noch einen pauschalen Entwicklungsstopp. Der globale Abschluss nennt tatsächlich erreichte Ergebnisse und noch notwendige externe Schritte.
