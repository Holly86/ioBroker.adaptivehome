# Einrichtung ohne JSON

Diese Anleitung beschreibt die **Einrichtung ab Beta 9**. Frühere veröffentlichte
Pakete bleiben unverändert.

Adaptive Home verbindet die Fähigkeiten vorhandener ioBroker-Adapter. Zum Beispiel
kann ein Bewegungsmelder eines Herstellers eine Leuchte eines anderen Herstellers
steuern. Die Geräteadapter bleiben für Verbindung, Anmeldung und Gerätekommunikation
zuständig. Adaptive Home ergänzt Zuordnung, Regeln, Grenzen und nachvollziehbare
Entscheidungen. Es wird kein zweites Herstellerkonto eingerichtet.

## Wo beginne ich?

1. Geräte zunächst im jeweiligen Herstelleradapter einrichten. Dort müssen passende
   Datenpunkte und Gerätemeldungen vorhanden sein.
2. Adaptive Home starten und im ioBroker-Admin den Reiter **Adaptive Home** öffnen.
   Oben die gewünschte Adaptive-Home-Instanz und Sprache auswählen.
3. **Geführte Einrichtung** öffnen. Eine leere Installation zeigt diese Seite zuerst.
   Die normale Instanz-Konfigurationsseite verweist auf diesen Reiter; ihre JSON-Felder
   sind für optionale Spezialanbindungen, nicht für die tägliche Grundeinrichtung.
4. Die fünf Abschnitte unten durchgehen. Dafür ist kein JSON nötig.

## 1. Räume und Anlagen

| Feld | Bedeutung |
| --- | --- |
| Name des Raums oder der Anlage | Frei gewählter Name, etwa Arbeitszimmer oder Wintergarten. |
| Art des Bereichs | Raum für einen Wohnbereich; Anlage für eine beliebige technische Zusammenstellung. |
| Zeitzone für Zeitpläne | Die tatsächlich gewünschte Ortszeit. Sie gilt für Wochenpläne und Sommerzeitwechsel. |

**Bereich zum Entwurf hinzufügen** erzeugt die interne Kennung automatisch.
Bestehende Räume und Anlagen bleiben erhalten. Mehrere Geräte können später in
derselben Funktion oder in unabhängigen Funktionen verwendet werden.

## 2. Geräte aus vorhandenen Adaptern übernehmen

1. **Installierte Adapter laden** liest die installierten, unterstützten Instanzen.
   Angezeigt werden passende Hersteller-/Quellenadapter und optional SQL.
   Es werden keine Anmeldedaten an die Oberfläche übertragen oder dort angezeigt.
2. Im Feld **Hersteller- oder Quellenadapter** die konkrete Instanz wählen,
   beispielsweise eine von mehreren Hue-Instanzen.
3. **Geräte in diesem Adapter suchen** liest ausschließlich dessen vorhandene
   Objektbeschreibungen. Es startet keinen Adapter, meldet sich nicht beim Hersteller
   an, testet keinen Aktor und übernimmt keine Hausregel.
4. **Erkanntes Gerät oder Quelle** auswählen und unter **Dein Gerätename** einen
   verständlichen eigenen Namen vergeben. Vorhandene Gerätenamen werden, soweit vom
   Herstelleradapter geliefert, in den Vorschlägen angezeigt.
5. **Geplante Verwendung** auswählen und **Gerät zum Entwurf hinzufügen** drücken.

| Verwendung | Ergebnis |
| --- | --- |
| Nur Daten lesen | Schreibzuordnungen werden aus der übernommenen Kopie entfernt; das Gerät erhält keine Steuerfreigabe. |
| Steuerbares Gerät vorbereiten | Nur bei einer erkannten Schreib- und Rückmeldefähigkeit angeboten. Gerät, Rückmeldung und alleinige Steuerzuständigkeit müssen ausdrücklich geprüft werden. Noch keine Funktion wird eingeschaltet. |

Die Auswahl **aktiviert** bei einer Adapterinstanz beschreibt deren Einstellung.
Sie belegt weder eine laufende Verbindung noch frische Gerätewerte. Ein gestoppter
Adapter kann noch alte Objekte besitzen. Modelle, Datentypen, Einheiten und
Rückmeldungen müssen zur [Kompatibilitätsmatrix](compatibility.md) passen.

Unter **Quelldatenpunkte und Fähigkeiten** stehen die technischen Zuordnungen zur
Kontrolle. Unbekannte Modelle oder fehlende Rückmeldungen werden nicht durch eine
allgemeine Herstellerzusage ersetzt. Erkennung ist ein Vorschlag, keine Geräteabnahme.

Bereits übernommene Geräte und erkannte Überschneidungen mit Gruppenmitgliedern
werden nicht nochmals angelegt. Bestehende Zuordnungen unter **Geräte & Bereiche**
bearbeiten. Die geführte Einrichtung ändert vorhandene Zuordnungen nicht stillschweigend.

### Welche Quellen sind vorgesehen?

Die Adapterliste entsteht aus den registrierten Herstellerprofilen und dem aktuellen
Bestand. Zusätzliche vertrauenswürdige Profile ergänzen sie ohne neue Raum- oder
Regelseiten. Die Grundfamilien umfassen Shelly, Homematic/CCU, HmIP, Hue, Philips Air
und unterstützte IKEA-Anbindungen. Optionale reine Leseprofile umfassen
mihome-vacuum, radar2, solarmanpv, openweathermap, nina, harmony und alexa2.

Ein Gerät muss zum dokumentierten Modell und zur jeweiligen Anbindungsvariante
passen. Insbesondere ist radar2-Gerätesichtbarkeit keine gesicherte Anwesenheit einer
Person, ein Alexa-Medienstatus keine Freigabe zur Sprachbedienung und ein
Staubsaugerstatus kein Reinigungsbefehl. NINA-Warnwerte bleiben von ihrer tatsächlichen
Abfrage abhängig; der Entdeckungsstandard beträgt 20 Minuten, Wetter standardmäßig
zwei Stunden, PV zehn Minuten, die übrigen Kontextprofile fünf Minuten.
Diese Höchstalter sind keine Aktualisierungsgarantie.

## 3. Alltagsfunktionen vorbereiten

Zuerst Sensoren als Lesequellen und den gewünschten Ausgang als steuerbares Gerät
übernehmen. Anschließend Namen, Bereich, Vorlage, Ausgang und Eingänge auswählen.
Die Auswahllisten enthalten nur passende Datentypen und Fähigkeiten.

| Vorlage | Erforderliche Auswahl | Alltagseinstellungen |
| --- | --- | --- |
| Licht bei Bewegung | Boolescher schaltbarer Ausgang, Bewegung, Helligkeit in Lux | Nachlauf nach ununterbrochener Ruhe in Minuten; Einschaltschwelle in Lux. |
| Raumtemperatur | Normaler schreibbarer Sollwert und echte gemessene Temperatur; Fensterkontakt optional | Komfort- und Absenktemperatur in °C innerhalb der Geräte- und Funktionsgrenzen. |
| Lüfter nach Luftqualität | Numerischer Lüfter in Prozent und Luftqualitätssensor | Schwelle in der Einheit des gewählten Sensors; niedrige/hohe Leistung in Prozent. Benannte Lüftermodi gehören in die erweiterte Zuordnung. |
| Steckdose oder Licht nach Zeitplan | Boolescher schaltbarer Ausgang | Gewählte Wochentage, Beginn und Ende in der eingestellten Zeitzone. Außerhalb gilt AUS. Ein über Mitternacht reichendes Fenster beginnt am ausgewählten Tag. |

Beispiel: Bewegung und Helligkeit eines Sensors sowie eine Leuchte eines anderen
Adapters übernehmen. Bereich Arbeitszimmer, Vorlage Licht bei Bewegung, Nachlauf
20 Minuten und die passende Luxschwelle wählen. **Deaktivierte Funktion zum Entwurf
hinzufügen** speichert die Vorbereitung im Formular. Es wird kein Gerät geschaltet.

Jede neue Funktion ist **deaktiviert**, verwendet klassische Regeln und hat keine
Lernfreigabe. Unter **Funktionen** lassen sich alle Details bearbeiten: Grenzen,
Handvorrang, Zeitfenster, Bedingungen, Ausnahmen und technische Schutzregeln.
Erst nach Prüfung der Zuständigkeit und Rückmeldung die Funktion bewusst aktivieren.
Ein physischer Ausgang erhält auch bei deaktivierten Funktionen keinen zweiten
unabhängigen Funktionsbesitzer.

Die Zeitplanvorlage ist für abschaltbare Verbraucher. Dauerpumpen, essenzielle
Betriebsmittel und native zeitbegrenzte Heizprofile benötigen die entsprechenden
erweiterten Formulare und tatsächlich geprüfte Geräteverträge. Ein normaler Sollwert
ist kein autonom ablaufender Heizplan. Siehe [Regelverträge](policy-parity.md) und
[Anbindungen](connections.md).

## 4. Optionale SQL-Protokollierung

Den SQL-Adapter separat installieren und seine Datenbank einrichten. Dann die
vorhandene SQL-Instanz auswählen. **Adaptive-Home-Daten in SQL speichern** aktiviert
den Export erst beim Übernehmen der Konfiguration. Beobachtungen und erzeugte
Ereignisse lassen sich getrennt auswählen. Warteschlange und Übertragungsgrößen
bleiben über die erweiterten Einstellungen bearbeitbar und werden vom Assistenten
nicht zurückgesetzt.

Es werden eigene Adaptive-Home-Datensätze über die SQL-Schnittstelle gespeichert.
Der Adapter aktiviert keine Historisierung fremder Gerätedatenpunkte und führt kein
frei eingegebenes SQL aus. InfluxDB ist hier kein unterstütztes Exportziel. Ohne SQL
bleibt die Steuerung funktionsfähig; der begrenzte interne Verlauf bleibt verfügbar.

## 5. Prüfen, übernehmen und später aktivieren

- **Entwurf prüfen** validiert den gesamten Entwurf. Es ändert noch nicht die aktive
  Revision. Ein Fehler erhält die bisher gültige Konfiguration.
- **Änderungen aktivieren** übernimmt den gesamten geprüften Entwurf als neue
  Revision. Bereits aktive Funktionen können danach entsprechend ihrer geänderten
  Einstellungen arbeiten. Neue Funktionen des Assistenten bleiben deaktiviert.
- **Neu laden** verwirft die ungespeicherten Änderungen und lädt die aktive Revision.
- **Vorige Konfiguration** übernimmt die letzte gültige Konfiguration als geprüfte
  Rücknahme. Das ersetzt keinen abgesprochenen Rückweg für eine fremde Haussteuerung.

Bei einer Änderung in einem anderen Adminfenster verhindert die Revisionsprüfung
ein unbemerktes Überschreiben. Eigenen Entwurf privat sichern, neu laden und Änderungen
abgleichen. Eine erfolgreiche Konfigurationsprüfung ist keine Hardwareabnahme.

Auch ein Instanzwechsel lädt einen anderen aktiven Stand. Ungespeicherte Arbeit
vorher als private Kopie des vollständigen JSON-Entwurfs sichern. Der normale
Exportknopf exportiert die aktive Serverkonfiguration ohne Nachrichtenempfänger,
nicht einen noch ungespeicherten Formularentwurf.

**Beobachten ist ein Lernmodus, kein globaler Schreibstopp.** Klassische Regeln
können dabei weiter schalten. Für einen reinen Lesepilot keine aktiven Steuerfunktionen,
Szenen oder externen Bedienfreigaben einrichten. Eine Geräteübergabe braucht einen
eindeutigen Schreiber, geprüfte Handbedienung, Fristen, Geräteverhalten und Rückweg.

## Erweiterte Formulare und JSON

Die detaillierten Formulare unter **Geräte & Bereiche**, **Funktionen**, **Lernen**
und **Import & Kanäle** bleiben erhalten. Es gibt nur einen Konfigurationsentwurf
und dieselbe serverseitige Prüfung für Formulare, JSON und Dateiimport.

Unter **Import & Kanäle → Erweiterte Konfiguration (JSON)**:

1. Der Editor zeigt den aktuellen vollständigen Formularentwurf, einschließlich
   besonderer Felder. Vor einer größeren Änderung eine private Kopie sichern.
2. JSON bearbeiten und **JSON prüfen und als Entwurf übernehmen** wählen.
3. Schreibfehler oder ungültige Inhalte lassen den bisherigen Entwurf bestehen.
   Solange JSON-Änderungen noch nicht übernommen sind, ist eine Aktivierung über die
   Fußleiste gesperrt. Der Text bleibt zur Korrektur erhalten.
4. Werden währenddessen Formulare geändert, wird ein veralteter JSON-Entwurf nicht
   darübergelegt. JSON separat sichern und mit **JSON durch aktuellen Formularentwurf
   ersetzen** auf den aktuellen Stand wechseln.
5. Nach erfolgreicher Prüfung stehen die übernommenen Werte in den Formularen.
   Erst **Änderungen aktivieren** speichert die Revision.

### Orientierung im JSON

| Abschnitt | Inhalt und Einsatz |
| --- | --- |
| `groups` | Räume/Anlagen mit stabiler Kennung, Anzeigename und Art. |
| `bindings` | Physische Identität, optionaler Gerätename `name`, Herstellerprofil und Fähigkeiten. |
| `bindings[].capabilities` | Lese-/Schreib-/Rückmeldepunkt, Typ, Einheit, Umrechnung, erlaubte Werte, Höchstalter und echte Frischenachweise. |
| `functions` | Bereich, ausgewählter Aktor und benannte Eingänge, Regeln, Parameter, Grenzen und Aktivierungszustand. |
| `functions[].behavior`, `climate`, `nativeProgram` | Besondere Handbedienung, Komfortbedingungen und dokumentierte native Heizpläne. |
| `functions[].autonomy` | Lernmodus, ausdrückliche Freigaben, erlaubte Bereiche, Änderungsbudget und Rücknahmebedingungen. |
| `connections`, `nativeTransports` | Besondere Quellenprojektionen und geprüfte Heiztransportverträge. Keine normale Pflichtinstallation. |
| `sources` | Gewählte Kontextfähigkeiten und deren Verwendung. |
| `logging` | SQL-Export, Warteschlange und Übertragungsintervalle. |
| `notificationRoutes`, `scenes` | Optionale Nachrichtenrouten und ausdrücklich eingerichtete gemeinsame Bedienaktionen. |

Beispielausschnitt aus einer Funktion — **kein vollständiger Import**:

```json
{
  "enabled": false,
  "parameters": { "holdMs": 1200000, "luxThreshold": 100 },
  "limits": { "commandsPerHour": 30, "manualHoldMs": 1800000 }
}
```

Im vollständigen Editor bleiben alle weiteren Pflichtfelder erhalten. `1200000`
Millisekunden entsprechen 20 Minuten. Technische JSON-Zeiten sind überwiegend
Millisekunden; Uhrzeiten von Wochenfenstern sind `HH:MM` in `timezone`.
Kennungen und Referenzen dürfen nicht unabhängig voneinander umbenannt werden.
Unbekannte Felder, freie Skripte oder fremde Befehle sind keine Erweiterungsschnittstelle.

Ein vorhandener Geräte- oder Gruppenname kann als zusätzliches optionales `name`
gespeichert werden; ältere Konfigurationen ohne dieses Feld bleiben gültig.
Ältere Adapterpakete vor dieser Erweiterung kennen das zusätzliche Feld nicht:
vor einem Paket-Rückweg einen passenden Konfigurationsexport bereithalten.

Zugänge, Tokens und Dateipfade für optionale Spezialanbindungen gehören in die
geschützten Instanzeinstellungen beziehungsweise die zuständigen Herstelleradapter.
Sie gehören nicht in öffentliche Beispiele. JSON mit realen Gerätekennungen,
Räumen oder Nachrichtenempfängern bleibt privat. Der normale Export entfernt
Nachrichtenempfänger; eine direkt kopierte Editorfassung enthält sie gegebenenfalls.

## Häufige Fragen

**Der Adapter fehlt in der Liste.** Im Herstelleradapter beginnen und erneut laden.
Nicht jedes Gerät wird automatisch erkannt. Allgemeine Datenpunktzuordnung und
Hersteller-SDK bleiben über die erweiterten Wege verfügbar.

**Ein Sensor ist sichtbar, aber sein Wert fehlt.** Datenqualität, Zeitstempel,
Quellenverbindung, Einheit und Geräteerreichbarkeit prüfen. Ein neuer Empfangszeitpunkt
oder ein laufender Prozess ersetzt keinen Messnachweis. Fehlende Werte sind unbekannt,
nicht AUS oder null. Keine Abfragefristen oder Herstellersperren durch Neustarts umgehen.

**Die Leuchte wird nicht als Ausgang angeboten.** Es fehlt eine geeignete bestätigte
Schreib-/Rückmeldezuordnung, das Gerät wurde nur lesend übernommen, ein Ausgang erlaubt
nur AUS oder die Fähigkeit ist nicht passend. Unter Geräte & Bereiche prüfen.

**Wird volle Automatik unterstützt?** Ja, getrennt und optional unter Lernen. Der
Assistent erteilt dafür keine Freigabe. Alle fünf Modi und ihre Grenzen beschreibt
die [Bedienungsanleitung](guide.de.md#lernen-und-volle-automatisierung).

Weitere Einzelheiten: [Betrieb](operations.md), [Quellen](connections.md),
[Kompatibilität](compatibility.md), [Hersteller-SDK](integration-sdk.de.md),
[Prüfstand](testing.md).
