# Quellen und Wiederverwendung

Stand der Quellenprüfung: 8. November 2026. Primärquellen der jeweiligen Projekte. Die Links belegen vorhandene Bausteine; Architektur und APs sind der Projektentwurf. Versions-/Kompatibilitätsaussagen werden bei der Umsetzung erneut geprüft und festgehalten.

- [Adaptergenerator](https://github.com/ioBroker/create-adapter): Gerüst und Entwicklungswerkzeuge; Versionen bei Umsetzung kompatibel festlegen.

- [Adapter API](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterref.md): Öffentliche Adapter-Schnittstellen für Objekte, Zustände und Ereignisse.

- [Admin Konfiguration und gemeinsamer Tab](https://github.com/ioBroker/ioBroker.admin/blob/master/packages/jsonConfig/README.md): JSON-Konfiguration, Komponenten und gemeinsamer Menüpunkt für mehrere Instanzen.

- [Gerätetyperkennung](https://github.com/ioBroker/ioBroker.type-detector): Wiederverwendbare Erkennung; sie ersetzt keine Funktions- und Identitätsprüfung.

- [Adapter Tests](https://github.com/ioBroker/testing): Paket- und Controller-Integrationstests.

- [Veröffentlichung](https://www.iobroker.com/docs/dev/adapterpublish.md): Paket-/Repositoryanforderungen; aktuelle Detailanforderungen vor Release erneut prüfen.

- [Shelly](https://github.com/iobroker-community-adapters/ioBroker.shelly): Bestehende Anbindung; keine pauschale Aussage über alle Funktionen jedes Geräts.

- [Homematic IP Cloud](https://github.com/iobroker-community-adapters/ioBroker.hmip): Bestehende Cloud-Anbindung und dokumentierte Grenzen.

- [Homematic CCU](https://github.com/ioBroker/ioBroker.hm-rpc): Eigenständiger Anbindungsweg; nicht mit Access Point gleichsetzen.

- [Philips Hue](https://github.com/iobroker-community-adapters/ioBroker.hue): Bestehende Bridge-Anbindung; Modell-/Adapterunterstützung prüfen.

- [Philips Air](https://github.com/iobroker-community-adapters/ioBroker.philips-air): Modellabhängige Luft-/Lüfterfunktionen; nicht alle Statuscodes/Timer verallgemeinern.

- [IKEA Tradfri](https://github.com/AlCalzone/ioBroker.tradfri): Gatewaygebundener älterer Weg, keine automatische Dirigera-Zusage.

- [Matter](https://github.com/ioBroker/ioBroker.matter): Möglicher optionaler Weg je konkretem Gerät/Gateway.

- [ZigBee](https://github.com/ioBroker/ioBroker.zigbee): Weiterer möglicher vorhandener Gerätezugang, gezielte Kompatibilitätsprüfung erforderlich.

- [HeatingControl](https://github.com/rg-engineering/ioBroker.heatingcontrol): Wiederverwendung vor eigener Implementierung prüfen; keine zweite konkurrierende Steuerung aktivieren.

- [Scheduler](https://github.com/ioBroker/ioBroker.scheduler): Vorhandene Zeitplanfunktionen prüfen; einen maßgeblichen Ausführungspfad erhalten.
