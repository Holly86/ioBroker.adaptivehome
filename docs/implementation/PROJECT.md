# Adaptive Home Produktauftrag

Adaptive Home soll unterschiedliche ioBroker-Geräte zu einer verständlichen, effizienten und optional selbstlernenden Steuerung zusammenführen. Nutzer richten die gewünschten Funktionen direkt im Admin ein. Der Adapter ist ein separates öffentliches Produkt, dessen allgemeine Nutzbarkeit nicht von einer bestimmten Bestandsinstallation abhängt.

## Zielumfang

- Räume und frei benannte Anlagen mit frei zugeordneten Geräten und Quellen.
- Herstellerunabhängige Fähigkeiten und ein einfach erweiterbares Hersteller-SDK.
- Startfamilien Shelly, Homematic/CCU und Homematic IP Cloud, Philips Hue und Philips Air; IKEA zusätzlich optional und nach tatsächlicher Anbindungsvariante geprüft.
- Klassische Zeit-, Sensor-, Nutzungs- und Bedienregeln für Licht, Klima, Luft und allgemeine Betriebsmittel einschließlich Dauerbetrieb und Pumpen.
- Optionale Quellen für Wetter, Kalender, Anwesenheit und Energie.
- Optionale Telegram-, Pushover- und E-Mail-Meldungen; optionaler berechtigter Rückkanal.
- Lokales Lernen und optionale KI-Anbieter mit einem echten vollautomatischen Modus.
- Gemeinsamer Admin mit Einrichtung, Livezustand, Erklärung, Historie, Konfiguration, Erkenntnissen und Rücknahme.
- Eine klare Gerätebestätigung und begrenzte lokale Störung statt einer irreführenden globalen Erfolgsmeldung oder eines globalen Regelstopps.

## Was Allgemeinheit bedeutet

Ein Nutzer ohne Pool kann eine Anlage aus Dauerpumpe, Tagesbeleuchtung und Sensoren einrichten. Ein anderer betreibt nur Wohnraumklima. Ein dritter verbindet Luftreiniger und Nutzungssignale. Die gleiche Software unterstützt diese Fälle durch Konfiguration. Funktionen ohne passende Geräte werden nicht als Pflichtdialog angezeigt.

Weder ein Herstellername noch ein Gerätename legt die Verwendung sicher fest. Die Einrichtung bestätigt Geräteidentität, Fähigkeiten, Zweck und Betriebsbedingungen. Ein Relais kann eine Leuchte oder einen unverzichtbaren Verbraucher bedienen; diese Funktionen dürfen nicht dieselbe pauschale Abwesenheitsregel erhalten.

## Ziele der ersten öffentlichen Beta

Der zentrale Regel- und Ausführungskern ist vollständig nutzbar, die gemeinsamen Admin-Wege funktionieren, die drei Referenzfälle sind in einer frischen Testinstallation abgenommen und das SDK hat einen unabhängigen Erweiterungstest bestanden. Alle fünf Lernmodi existieren tatsächlich. Es gibt keine Pflicht zu einem KI-Anbieter oder Nachrichtenkanal.

Herstellersupport wird abgestuft ausgewiesen: geplant, implementiert, vertraglich geprüft, gegen realen Backend-Adapter integriert und mit konkretem Gerät getestet. Eine Beta darf offene Hardwarefälle haben. Sie darf daraus keine allgemeine Herstellerfreigabe oder volle produktive Eignung ableiten.

## Bezug zu vorhandener Software

Vorhandene ioBroker-Komponenten und geeignete geprüfte Regelbibliotheken sollen Arbeit sparen. Übernahme erfolgt nach Herkunfts-, Lizenz- und Datenprüfung und durch allgemeine Verträge. Kein zweiter herstellerspezifischer Cloud-Client, wenn eine geeignete Anbindung bereits existiert. Bestehende Privatkonfiguration wird nicht zur öffentlichen Standardkonfiguration.
