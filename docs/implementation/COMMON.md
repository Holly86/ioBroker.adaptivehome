# Gemeinsamer Umsetzungsauftrag

Adaptive Home wird ein eigenständiger öffentlicher ioBroker-Adapter für eine herstellerübergreifende, dynamisch konfigurierbare und optional selbstlernende Steuerung. Der Nutzer stellt Geräte, Räume, Anlagen, Ziele und Betriebsregeln selbst zusammen. Ein Pool, Aquarium oder bestimmter Haushalt ist keine Voraussetzung. Diese Datei gilt zusammen mit PROJECT.md, ARCHITECTURE.md, DATA-CONTRACTS.md, AUTONOMY.md und ACCEPTANCE.md für jedes Arbeitspaket.

## Produktgrenzen

- Ein installierbares Adapterpaket mit gemeinsamer Admin-Oberfläche. Steuerung und Diagnose sind ohne Node-RED, Jarvis, OpenClaw, KI, Hersteller-Vollausstattung oder eingerichteten Nachrichtenkanal benutzbar.
- Shelly, Homematic, Philips Hue und Philips Air sind die ersten Integrationsfamilien; IKEA ist eine zusätzliche optionale Familie. Gerätefunktionen werden je Modell, Anbindungsart und Version ausgewiesen. Keine pauschale Zusage für ein ganzes Herstellerportfolio.
- Der Kern arbeitet mit Fähigkeiten und semantischen Funktionen. Ein schaltbarer Ausgang ist noch keine Pumpe; der Nutzer ordnet seine Bedeutung, Betriebsart und Grenzen zu. Neue Hersteller benötigen keine Änderungen an bestehenden Regelmodulen.
- Vorhandene ioBroker-Geräteadapter bleiben die bevorzugte Verbindung. Neue unabhängige Cloud-Sitzungen, geänderte Dateien installierter Fremdadapter und private Spezialbrücken sind keine öffentliche Standardinstallation.
- Automatisch vorgeschlagene Zuordnungen werden bei der Einrichtung bestätigt. Mehrfach entdeckte physische Geräte erhalten einen einzigen aktiven Befehlspfad. Unbekannte Eigenschaften bleiben unbekannt.
- Wetter, Kalender, Anwesenheit, Energie, Benachrichtigungen und KI sind einzeln optional. Fehlende optionale Quellen blockieren keine unabhängigen Funktionen.
- Die Nutzer können beliebig benannte Räume und Anlagen mit beliebig vielen unterstützten Funktionen konfigurieren; keine fest codierten Personen, Adressen, Geräte-IDs, Zeitzonen, Schulkalender oder Nachrichtenempfänger.

## Architekturentscheidungen

TypeScript, aktuelle kompatible ioBroker-Werkzeuge, sauber getrennte Fachmodule und ein versioniertes Schema sind die Grundlage. Laufzeit- und Bibliotheksversionen vor Installation anhand offizieller Quellen und der gewählten Testmatrix festlegen und im Lockfile fixieren. Nicht blind den Entwicklungsstand eines Herstellertreibers installieren.

Konfiguration, Konnektoren, Kontext, Entscheidungsregeln, Ausführung, Diagnose und Lernverfahren haben ausdrückliche Schnittstellen. Fachregeln lesen weder Herstellerobjekte direkt noch kennen sie private Netzwerkadressen. Die Integrationsschicht normalisiert Werte und tatsächliche Fähigkeiten. Nur die Ausführungsschicht schreibt Geräte.

Eine gemeinsame Admin-Ansicht darf mehrere unabhängige Funktionsinstanzen verwalten. Die Laufzeit wird mindestens so getrennt, dass ein Lernprozess oder eine fehlerhafte optionale Anlage andere Steuerungen nicht beendet. Keine notwendige zentrale UI- oder KI-Prozessverbindung im unmittelbaren Schaltpfad. Gemeinsame Zustände können über ioBroker bereitgestellt werden; Quellenverlust hat dokumentierte lokale Folgen.

Die aktive Konfiguration hat einen maßgeblichen Speicher, eine Revision und eine letzte gültige Version. Änderungen werden zusammenhängend geprüft und aktiviert. Alltagswerte können live übernommen werden. Herstellerzugänge bleiben bei den zuständigen Geräteadaptern oder im geeigneten geschützten Speicher. Exportiert werden standardmäßig keine Geheimnisse.

## Ausführungsregeln

Ein Auftrag durchläuft requested, validated, accepted, device_confirmed oder failed/uncertain. accepted bedeutet keine Gerätebestätigung. Veraltete Antworten, eigene Rückmeldungen und neue Handbedienung werden unterschieden. Auftrags-ID, Generation, Zielgerät, Frist und Konfigurationsrevision verbinden Entscheidung und Wirkung.

Schreibrechte pro physischem Gerät sind eindeutig. Konflikte zwischen Regeln werden vor dem Schalten entschieden. Einmalige Befehle und wiederkehrende Pläne brauchen unterschiedliche Fristen. Nach Neustart werden keine alten Schreibwarteschlangen oder unsicheren Ausschaltfristen wieder abgespielt. Manuelle Änderungen entziehen der Automatik nach definierter Regel die Zuständigkeit.

Ausfallverhalten ist pro Funktion festgelegt: native Heizprofile erhalten Wärmeanforderungen und vereinbarte Basiswerte; eine unverzichtbare Umwälzung wird nicht durch Abwesenheitsoptimierung ausgeschaltet. Eine Pumpenstörung kann trotzdem ein Abschalten erfordern, wenn eine verifizierte Schutzbedingung dies verlangt. Deshalb weder ein globales AUS noch ein globales EIN als Universalantwort verwenden. Unbekannte Schutzbedingungen nicht erfinden.

Ein fehlender Raum-Audit sperrt nur die betroffene Funktion. Bestätigte unabhängige Funktionen laufen weiter. Echte Cloud-Sperren, unbekannte Ausführung und fehlende Geräteeigenschaften werden nicht durch blinde Wiederholungen umgangen. Budgets, Fristen, Störungsjournal und Handwünsche überstehen Neustarts. Alarmquellen enthalten Ursache, betroffenen Umfang und tatsächliche Auswirkungen.

Zeitstempel von Messung, Empfang, Auswertung und Befehl getrennt führen. Ein unveränderter Zustand ist nicht allein wegen unverändertem Änderungszeitpunkt veraltet. Umgekehrt beweist ein lebender Prozess keine frische Messung. Einheiten, Wertebereiche, Qualität und Quellenabdeckung gehören zu jedem relevanten Wert.

## KI und volle Automatisierung

KI ist optional. Die klassischen Regeln arbeiten ohne KI-Dienst. Lokales Lernen und Optimieren darf ebenfalls ohne externes Sprachmodell funktionieren. Externe Sprachmodelle oder OpenClaw sind austauschbare zusätzliche Anbieter.

Die fünf Modi sind: klassische Regeln ohne Lernen, beobachten, vorschlagen, begrenzt automatisch und vollautomatisch. Vollautomatisch bedeutet einen echten geschlossenen Ablauf aus Beobachten, Vorhersagen, Planen, Validieren, Ausführen, Gerätebestätigung, Wirkungsbewertung und weiterem Lernen. Innerhalb der einmal vom Betreiber eingerichteten Berechtigungen ist keine Bestätigung jeder einzelnen Anpassung nötig.

Auch im vollautomatischen Modus gelten vom Betreiber bestimmte harte Grenzen, dauerhafte Mindestfunktionen, technische Schutzregeln, Handbedienung und der Ausschluss nicht freigegebener Geräte. Der Optimierer darf Zeitpläne und erlaubte Regelkombinationen selbst aktivieren, aber keine beliebigen Skripte, Plugins, ioBroker-Datenpunkte oder Systembefehle erzeugen und ausführen. Er darf seine eigenen Grenzen nicht lockern. Details stehen in AUTONOMY.md.

Jede Anpassung hat Datenherkunft, Modellversion, Grund, erwartete Wirkung, Bewertung und einen Rückweg. Eine fehlerhafte Anpassung wird auf die letzte passende gültige Regel zurückgenommen; neue menschliche Wünsche werden dabei erhalten. Keine dauernde Nutzerfreigabe als verdeckte Voraussetzung des Modus vollautomatisch.

Komfort, Betriebskontinuität, Luftqualität, Verbrauch, Schalthäufigkeit und Verschleiß können unterschiedliche Ziele sein. Harte Bedingungen sind keine bloß gewichteten Wünsche. Energieeinsparungen nur anhand ausreichender Messungen behaupten; geschätzte Wirkung kennzeichnen.

## Öffentliche Entwicklung

Das neue Repository erhält eine neue Git-Historie. Nur die ausdrücklich freigegebenen öffentlichen Plan-Dateien und bereinigte Produktdateien veröffentlichen. Private Übergaben, reale Installationsdaten, alte Protokolle, Zugriffsdaten und vollständige Alt-Repositories bleiben draußen. Vor Übernahme vorhandener Module Herkunft, Lizenz und enthaltene Daten prüfen.

Entwicklungszweige verwenden den Präfix codex/. Bestehende fremde Änderungen erhalten, keine pauschalen Resets oder Löschungen. Vor jeder Veröffentlichung den vorgesehenen Diff, Teststand und Secret-/Datenprüfung kontrollieren. Abhängigkeiten und ihre Lizenzen dokumentieren. Keine undokumentierten Fernzugriffe oder Telemetrie einbauen.

Nachweise werden getrennt abgelegt: öffentliche bereinigte Zusammenfassungen unter docs/verification/AP-XX.md, private Rohdaten unter .local/evidence/AP-XX/. .local wird vor dem ersten Commit ignoriert und niemals exportiert. Aktuelle Betreibergeheimnisse gehören nicht in Quellcode, Testfixtures, Screenshots oder Issue-Vorlagen.

## Selbstständiger Arbeitsablauf

Arbeite die APs in Manifestreihenfolge ab, soweit ihre implementierten Schnittstellen verfügbar sind. Lies vor jedem AP seinen vollständigen Prompt und die einschlägigen gemeinsamen Dokumente. Liefere implementierte, integrierte Funktionen mit passenden Prüfungen. Dokumentationsgerüste, Mock-Antworten und laufende Container allein erfüllen keine Funktionsabnahme.

Pflege im neuen Repository docs/implementation/work-packages.json als einzige Fortschrittsliste. Der ursprüngliche Übergabestand bleibt unverändert. Nach jedem AP Ergebnis, Tests, Commit, verbleibende Prüfungen und nächste ausführbare Arbeit festhalten und weiterarbeiten, statt routinemäßig auf Zustimmung zu warten.

Status und Belege sind getrennt: implemented ist nicht verified; Vertragstest ist kein Hardwaretest. Fehlende Geräte oder Zugangsdaten blockieren einzelne Integrationsprüfungen, nicht automatisch alle weiteren Arbeiten. Arbeite mit Emulatoren an unabhängigen Funktionen weiter. Bezeichne diese Geräteunterstützung bis zur realen Prüfung entsprechend.

Notwendige externe Berechtigungen oder echte Mehrdeutigkeiten gezielt und mit vorbereitetem Ergebnis klären. Keine Zugangsdaten im Chat anfordern. Keine fehlende Nutzerantwort als Freigabe werten. Werkzeugrechte und verbindliche Systemregeln gelten weiterhin.

## Freigabe und Fertigstellung

Eine öffentliche Beta benötigt ein tatsächlich existierendes öffentliches Repository, bestandene Installation im frischen ioBroker-Testsystem, funktionsfähige Admin-Oberfläche, klassische Steuerung, die fünf Lernmodi einschließlich geschlossenem Automatikablauf, optionale Kanäle, dokumentierte Hersteller-Schnittstelle und die verbindlichen Generalisierungsfälle. Fehlende produktive Modellprüfungen bleiben in der Kompatibilitätsmatrix offen.

GitHub-Quellveröffentlichung, GitHub-Beta, installierbares Paket, npm-Veröffentlichung und Aufnahme in ioBroker latest/stable sind verschiedene Ergebnisse. Externe Freigaben nicht als erfolgt ausgeben. Eine Beta darf klar begrenzte, ungetestete Gerätefamilien ausweisen, aber keine unimplementierten Kernfunktionen als fertig bezeichnen.
