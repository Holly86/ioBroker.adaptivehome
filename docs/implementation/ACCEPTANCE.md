# Verbindliche Abnahmeszenarien

Jeder Fall erhält im neuen Repository Ergebnis, Prüfart, tatsächliche Belege und offene Voraussetzungen. Hardware- und Emulatornachweise bleiben getrennt. Die folgenden Fälle sind Anforderungen und wurden in diesem Planungsschritt nicht ausgeführt.

## S01 Frische Installation

Installiere das gebaute Paket in einem frischen ioBroker mit ausgewählter kompatibler Version. Starte und bediene es ohne private Dateien, Node-RED oder zusätzliche Pflicht-Webanwendung.

## S02 Nur benötigte Funktionen

Konfiguriere ausschließlich Licht. Kein Pool, kein Hersteller-Vollausbau, kein Mail-/KI-Dialog ist Pflicht.

## S03 Aquarium statt Pool

Konfiguriere eine frei benannte Anlage mit Dauerumwälzung, Tagesbeleuchtung und optionalem Sensor. Die Beleuchtung darf ausgehen, die zugesicherte Umwälzung bleibt bei Abwesenheit erhalten.

## S04 Klima und Luft

Ordne Raumklima und Luftreiniger getrennten Funktionen zu. Nur tatsächlich vorhandene Gerätefähigkeiten sind ausführbar.

## S05 Dynamische Bindung

Ändere Herstellerkombination, Geräteanzahl, Räume und Datenpunktpräfixe ohne Änderungen der Fachregeln.

## S06 Zusätzlicher Hersteller

Installiere ein vertrauenswürdig konfiguriertes Beispielplugin mit neuen Datenpunktstrukturen. Vorhandene Licht- und Anlagenmodule arbeiten unverändert.

## S07 Ein physischer Schreiber

Entdecke dasselbe Gerät über zwei Anbindungen und erzeuge konkurrierende Regeln. Es gibt eine bestätigte eindeutige Bindung und keine Doppelsteuerung.

## S08 Konfigurationsrevision

Aktiviere gültige und ungültige Mehrfeldänderungen. Ungültige Teilzustände gelangen nicht in die Steuerung; konkurrierende Änderungen werden erklärt.

## S09 Zeitplan und Sommerzeit

Prüfe über Mitternacht reichende Pläne, lokale Zeitzonen, Sommerzeit und befristete Vorgaben mit eindeutiger Frist.

## S10 Handbedienung

Ändere Sollwert oder Helligkeit während laufender Automatik. Der menschliche Vorrang gilt; eine eigene Zwischenrückmeldung wird nicht als neue Personeneingabe gelernt.

## S11 Lichtnachlauf

Echte oder explizit als simuliert bezeichnete frische Bewegung bei zulässigem Lux schaltet ein. Neue Bewegung verlängert; bestätigtes Aus folgt nach fünf Minuten zusammenhängender Ruhe im Referenzfall.

## S12 Kein alter Timer

Manuelles Aus/Ein und Neustart entwerten alte automatische Ausschaltaufträge. Fremd eingeschaltetes Licht wird nicht übernommen.

## S13 Leicht zukünftige Bewegung

Ein zunächst geringfügig zukünftiger Zeitstempel wird erst bei gültiger Zeit verarbeitet; der neue Impuls geht nicht verloren und ein alter Impuls löst keinen Neustartbefehl aus.

## S14 Ausgebliebene Aktion

Zu hell, Inhibit, fehlender Sensor und Gerätefehler haben unterschiedliche einmalige Diagnosegründe statt stiller Nichtfunktion.

## S15 Einzelner fehlender Audit

Der erste lesende Autoritätsabruf einer Funktion scheitert vorübergehend. Er wird zulässig erneut versucht; unabhängige geprüfte Funktionen laufen weiter.

## S16 Verzögerte Profilübernahme

Cloudannahme, Profilinhalt und mehrere Gerätemeldungen kommen zu unterschiedlichen Zeiten. Keine falsche Menschenvorgabe und kein unnötiger globaler Stopp.

## S17 Native Frist

Ein unterstütztes natives Programm läuft nach belegter Frist in die konfigurierte Mindestfunktion zurück. Nur verstrichene Zeit ohne Gerätebeleg reicht nicht als sichere Bestätigung.

## S18 Quelle und Verbindung

Wetter, Kalender, Anwesenheit, Datenbank oder eine Anbindung fallen getrennt aus. Unbekannt bleibt unbekannt; dokumentierte unabhängige Mindestfunktionen bleiben bestehen.

## S19 Cloudbudget

Befehlsgrenzen, Sperrzeiten, verspätete Antworten und Neustarts erzeugen keine blinde Wiederholung, Quotenrücksetzung oder positive Scheinsynchronisierung.

## S20 Bedarf und Versorgung

Ein Raum fordert Wärme, das Gerät bestätigt, aber der Raum wird nicht warm. Anzeige und Diagnose unterscheiden Datenproblem, Aktorproblem und ungemessene Wärmebereitstellung.

## S21 Kanäle optional

Betreibe alle Funktionen ohne Nachrichtenkanal. Aktiviere danach einen konfigurierten Testkanal; keine zusätzliche Grundabhängigkeit entsteht.

## S22 Störung bündeln

Gleiche Störung, Neustart, fehlende Kanalantwort und Erholung erzeugen passende begrenzte Meldungen an ausschließlich konfigurierte Empfänger.

## S23 Rückkanal schützen

Nicht berechtigte Nutzer, fremde Gruppen, veraltete Buttons und doppelte Aufträge erhalten keine Geräteaktion. Berechtigter Auftrag bleibt auf seinen Umfang begrenzt.

## S24 Lernbasis

Trainiere mit zeitlich getrennten Daten und Lücken. Zukünftiges Wissen und fehlende Beobachtung werden nicht als gültiges Training oder Abwesenheit übernommen.

## S25 Beobachten und Vorschlagen

In diesen beiden Modi aktiviert ein gelerntes Muster keine Geräteaktion ohne die dafür vorgesehene Annahme.

## S26 Begrenzt automatisch

Eine freigegebene Parameteranpassung wird automatisch ausgeführt; eine Änderung außerhalb des eingerichteten Profils wird abgelehnt.

## S27 Vollautomatisch

Nach einmaliger Einrichtung erstellt und aktiviert der Adapter selbst einen gültigen gelernten Plan sowie eine erlaubte Regelkombination, bestätigt die Gerätewirkung und bewertet sie ohne Änderungsdialog.

## S28 Grenzen bleiben hart

Ein Optimierungsvorschlag versucht eine Mindestfunktion oder ein ausgeschlossenes Gerät zu ändern. Er wird auch im vollautomatischen Modus abgelehnt.

## S29 Fehlwirkung und Rücknahme

Eine automatisch aktive Anpassung verschlechtert die definierte Bewertung. Die passende gültige Vorgängerlösung wird wiederhergestellt; neue Handwünsche bleiben erhalten.

## S30 KI und Modellverlust

Anbieter, Modellserver, Modelljournal oder Budget fallen aus. Die klassische letzte gültige Steuerung bleibt funktionsfähig; keine unnötige Nachforderung bezahlter Aufrufe.

## S31 Unvertrauenswürdiger Text

Ein Modell, Kalendertext oder Nachricht versucht freie Skripte oder fremde Datenpunkte zu nutzen. Strukturvalidierung und Berechtigung verhindern die Ausführung.

## S32 Lernprozess isolieren

Lernen oder eine fehlerhafte Funktionsinstanz wird beendet. Andere Schaltpfade, Fristen und native Mindestfunktionen bleiben bestehen.

## S33 Energie und Qualität

Vergleiche gemessene, integrierte und geschätzte Energie. Fehlende Abdeckung wird sichtbar; keine unbewiesene Einsparungszahl erscheint als Messergebnis.

## S34 Öffentliches Artefakt

Prüfe Git-Historie, Paketinhalt, Beispiele, Supportexport und CI auf private Daten/Geheimnisse. Installiere genau das veröffentlichte Artefakt erneut.

## S35 Bedienung und Sprache

Führe die drei Einrichtungen im Admin auf Deutsch und Englisch mit schmaler Darstellung und Tastatur durch; keine Quellcodebearbeitung ist nötig.

## S36 Betrieb und Rückweg

Update, Datenmigration, Rücknahme und Wiederaufnahme mit neuer Handvorgabe erhalten eindeutige Zuständigkeit und aktuelle gültige Konfiguration.
