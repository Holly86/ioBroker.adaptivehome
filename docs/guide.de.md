# Bedienungsanleitung

## Einrichtung

Installiere das gebaute Release-Paket nach README, lege eine Instanz an und öffne den Admin-Reiter
Adaptive Home. Der normale Admin sollte authentifiziert bleiben. Der Adapter vertraut seinem
Nachrichtentransport; fremde Adapter mit administrativem Datenbankzugriff liegen außerhalb dieser
Berechtigungsgrenze. Instanzeinstellungen enthalten optionale Herstellerdefinitionen, Rückkanalzugänge
und Modellanbieter. Die tägliche Einrichtung erfolgt im Reiter auf Deutsch oder Englisch.

1. Lege unter Geräte & Bereiche Räume oder frei benannte Anlagen an. Entdecke Backend-Datenpunkte
   oder erstelle allgemeine Zuordnungen. Prüfe Instanz/Kanal, Datentyp, Einheit, Skalierung/Wertzuordnung
   und Lese-, Schreib-/Rückmeldepunkt. Bestätige physische Identität und Gruppenmitglieder. Ein quittierter
   gemeinsamer Datenpunkt ist normalerweise Backend-Beleg. Gerätebeleg nur für dokumentierte
   Gerätemeldungen wählen. Ein Ausgang braucht einen eindeutigen zuständigen Schreiber.
2. Wähle unter Funktionen Licht, Klima, Luft oder Betriebsmittel. Ordne Aktor und vorhandene benannte
   Eingänge zu. Konfiguriere Parameter, Bedingungen, Zeitzone, Zeitfenster, Datumsausnahmen, Schutz,
   Abhängigkeiten, Mindestlauf-/Sperrzeiten und Budgets. Essenzielle Betriebsmittel brauchen eine
   ausdrückliche Mindestfunktion. Ein Relais belegt keinen Trockenlauf-, Tier- oder Wasserschutz.
3. Prüfe und aktiviere den vollständigen Entwurf. Ungültige Änderungen ersetzen die gültige Konfiguration
   nicht. Bei konkurrierenden Änderungen neu laden. Die Übersicht zeigt Ziel, Rückmeldung, Datengüte
   und Grund. Vor Aktorübernahme konkurrierende Automatikschreiber stoppen.

Fehlende Messwerte bleiben unbekannt. Unabhängige essenzielle Funktionen laufen weiter, während
anderen Eingänge fehlen. Während Controller-/Adapterausfällen tragen native Geräteprogramme ihre
eigene Mindestfunktion. Nicht unterstützte native Ablauffristen werden nicht als Gerätezusage simuliert.

## Drei Beispiele

Importiere unter Import & Kanäle ein Beispiel und bearbeite es mit Formularen. Vor realer Aktivierung
jeden `test.0`-Pfad und jede synthetische Identität ersetzen.

* Wohnung: Bewegung und Lux schalten Licht mit fünf Minuten zusammenhängender Ruhe. Nur frische
  Bewegung nach dem Start begründet automatische Zuständigkeit. Neue Bewegung verlängert die Frist.
  Handbedienung und Neustart entwerten alte Abschaltaufträge. Fremd eingeschaltetes Licht bleibt
  erhalten. Klima verwendet getrennt tatsächliche Temperatur/Fenster/Anwesenheit und Sollwerte.
* Aquarium oder andere Anlage: Tageslicht und Dauerumwälzung sind unabhängig. Licht darf ausgehen,
  essenzielle Umwälzung bleibt erhalten. Eine geprüfte Schutzbedingung kann Vorrang haben. Das Beispiel
  erteilt keine Freigabe für reale Tier-/Wassertests. Ein Pool ist keine Voraussetzung.
* Luftqualitätsbereich: Messgröße, Einheit, Lüfterwerte und Hysterese passend zum Gerät wählen.
  Philips-Air-Stufen können benannte Modi statt Prozentwerte sein. Unbekannte Modelle/Rohcodes
  bleiben ohne ausführbare Zuordnung.

## Lernen und volle Automatisierung

Beginne mit Klassischen Regeln oder Beobachten. Nutzungs-, Luftbedarfs- und thermische Modelle
trennen abgeschlossene Tage zeitlich in Training und Prüfung. Datendeckung, Lücken und positive
Beobachtungen entscheiden über die Zulassung; typischerweise sind vier volle Tage nötig. Begrenzte
Arbeitsprozesse isolieren das Training. Fehlende/ungeeignete Modelle lassen klassische Regeln bestehen.
Prognosen belegen keine Einsparung.

Richte pro Funktion Modus, Freigabe, Aktorfähigkeit, erlaubte Parameterbereiche und Zeit-/Sensor-/
Präsenzbausteine ein. Ergänze Änderungsbudget, Datenlücke, Bewertungsintervall und Ziele. Essenzielle/
ausgeschlossene Funktionen sind keine Optimierungsziele. Vorschlagen braucht die Annahme eines Plans.
Begrenzt automatisch ändert nur freigegebene Parameter. Vollautomatisch darf zusätzlich erlaubte
Regelkombinationen selbst aktivieren, ohne jede Änderung erneut abzufragen.

Aktivierung benötigt ein aktuelles zugelassenes Modell und vergleichbare Ausgangsbeobachtungen.
Jeder Befehl durchläuft dieselben harten Grenzen wie klassische Regeln. Plan und Befehlskennungen
halten die Rückmeldequalität fest. Bewertung vergleicht neue Messungen mit der Ausgangslage.
Verschlechterung, fehlende Belege, Unsicherheit, Ablauf oder neue Hand-/Konfigurationswünsche
entfernen die Anpassung und stellen eine gültige Vorgängerlösung oder klassische Regel wieder her.
Der kurze Vergleich kontrolliert äußere Ursachen nicht.

Pause deaktiviert Lernanpassungen; klassische Regeln laufen weiter. Fortsetzen prüft Plan/Freigabe
erneut. Abbrechen/Zurücknehmen entfernt den Plan. Für vollständigen Befehlsstopp die Funktion im Formular deaktivieren. Die Instanz lässt sich im ioBroker-Admin stoppen. Geräte können ihren
letzten Zustand beibehalten.

## Optionale Kanäle und Modelle

Nachrichtenrouten brauchen gewählte Telegram-/Pushover-/Mail-Adapter und Empfänger. Lege Schweregrad,
Funktionsumfang und Ruhezeiten fest. Störungen werden dauerhaft gebündelt; Kanalannahme belegt keine
Zustellung. Kein Kanal ist Voraussetzung. Rückkanäle brauchen vertrauenswürdige Gateways mit
ursprünglicher Nutzer-/Chat-Information, engen Rechten, mindestens 32 Zeichen Geheimnis und signierten,
kurz gültigen, revisionsgebundenen Aufträgen mit Wiederholungsschutz. Das Beispielgateway verwirft
weitergeleitete/bearbeitete/veraltete Telegram-Nachrichten. Ein Textdatenpunkt liefert diesen Nachweis
nicht. Siehe [Bedienprotokoll](control-protocol.md). Mail und Pushover melden nur.

Modellanbieter erhalten nur nach Freigabe begrenzte Zusammenfassungen. Konfiguriere HTTPS (lokal
Loopback-HTTP), Modell, Umfang und Anfrage-/Kostenbudgets. HTTP-JSON, Ollama und OpenAI-kompatible
Antworten sind unterstützt. Der optionale Aufruf liefert strukturierte Kandidaten zur Ansicht, keine
Skripte oder direkten Befehle. Lokale volle Automatisierung ist unabhängig davon. Bezahlte Aufrufe
und echte Kanalzustellung wurden nicht ausgeführt.

## Betrieb, Daten und Rückweg

Unklare Befehle werden nicht blind wiederholt. Gerätepfad/Verbindung prüfen, frischen Zustand
abgleichen, danach fortsetzen. Handvorrang kann gezielt aufgehoben werden. Neue Handwünsche bleiben
bei Rücknahme erhalten. Keine gleichzeitig aktiven alten/neuen Schreiber.

Historie ist auf sieben Tage/10.000 Einträge begrenzt. Supportexport entfernt Messungen, Gerätekennungen
und Empfänger. Normale Exporte enthalten private Zuordnungen; Backup/Datenbank bleiben privat.
Verlauf löschen entfernt Beobachtungen. Modelle/Pläne haben eigene Journale; bei vollständiger
Datenlöschung ebenfalls entfernen.

Vor Updates exportieren und ioBroker sichern. Lernanpassungen pausieren, Instanz stoppen, geprüftes
Paket installieren, Admin-Dateien hochladen und starten. Konfiguration bleibt im ioBroker-Datenspeicher.
Bei Problemen vorige gültige Konfiguration oder vorige geprüfte Paketversion samt kompatiblem Backup
wiederherstellen. Es gibt keine ältere Produktivversion. Beta 1 hat eine bekannte Zuständigkeitslücke und ist kein Rückweg bei Aliasproblemen.
Details: [Betrieb](operations.md), [Kompatibilität](compatibility.md), [Prüfungen](testing.md).

[Hersteller erweitern und tatsächlicher Geräteprüfstand](integration-sdk.de.md).

Beta 2 erlaubt genau eine Funktion pro physischem Ausgang, auch bei deaktivierten Aliasfunktionen. Zeitpläne, Bedingungen und harte Grenzen in dieser Funktion zusammenführen. Vor dem Update von Beta 1 sichern/exportieren und überlappende Aliasfunktionen im Admin entfernen. Mehrdeutige gespeicherte Konfigurationen werden abgelehnt; eine gültige private Konfiguration wiederherstellen, statt Zuständigkeit automatisch zu raten.

Beta 3 trennt Soll- und Messtemperaturen und schließt mehrdeutige Hue-Aktoraliase, Sensorfreigaben und automatische Gruppenvorschläge aus. Quelleinheiten müssen zur Umrechnung passen; Wh werden nach kWh normalisiert. Ältere Air-cx-Ein/Aus-/Lüfterprozent-Pfade bleiben lesend. Die Erkennung schreibt gespeicherte Bindungen nicht automatisch um: Zuordnungen, physische Identität und Datenalter vor Aktivierung prüfen. Der Lernmodus Beobachten stoppt klassische Regeln nicht; ein rein lesender Shadow-Pilot benötigt eine Laufzeit ohne Aktorschreibschnittstelle.
