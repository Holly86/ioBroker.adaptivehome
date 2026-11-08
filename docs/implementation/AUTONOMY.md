# Lernmodi bis zur vollen Automatisierung

## Die fünf Modi

| Modus | Erlaubtes Verhalten | Geräteausführung aus Lernen |
| --- | --- | --- |
| Klassische Regeln | Eingestellte Zeit-, Sensor- und Bedienregeln | Aus |
| Beobachten | Datenqualität und Nutzungsmuster auswerten | Aus |
| Vorschlagen | Begründete überprüfbare Änderungen anbieten | Erst nach Annahme |
| Begrenzt automatisch | Freigegebene Parameter selbst anpassen | Innerhalb des eingerichteten Profils |
| Vollautomatisch | Gültige Pläne und erlaubte Regelkombinationen selbst erzeugen, aktivieren und weiterentwickeln | Ohne Bestätigung jeder einzelnen Anpassung |

Der Unterschied zwischen den letzten beiden Modi muss implementiert und in der Oberfläche verständlich sein. Ein Modus vollautomatisch, der tatsächlich jede Änderung nur als wartenden Vorschlag ablegt, erfüllt das Produktziel nicht.

## Volle Automatisierung als geschlossener Ablauf

1. Beobachtungen und Gerätequalität prüfen, ausreichend belastbare Historie berücksichtigen.
2. Nutzung, thermische Reaktion oder Betriebsbedarf prognostizieren und Unsicherheit ausweisen.
3. Gültige Kandidaten aus zugelassenen Parametern und Regelbausteinen erstellen.
4. Harte Bedingungen zuerst prüfen, anschließend die konfigurierten Ziele optimieren.
5. Einen geeigneten Kandidaten innerhalb des freigegebenen Umfangs selbst aktivieren.
6. Ausführung und echte Rückmeldung überwachen, Fehlwirkung oder Schalthäufigkeit begrenzen.
7. Wirkung gegen die vorherige gültige Lösung bewerten und das Modell fortschreiben.
8. Bei Verschlechterung, Datenbruch oder Störung die passende sichere Vorgängerlösung wiederherstellen und die Ursache dokumentieren.

Das Beispiel eines frühen Nutzungsbeginns kann zu einem vorgezogenen Heiz- oder Lichtplan führen. Die Entscheidung bleibt von der Nutzerfreigabe für genau diese Funktionsinstanz, gültiger Anwesenheit, technischen Fähigkeiten und zulässigen Zeiten abhängig. Das ist keine Freigabe zum eigenständigen Verändern von Sensoroffsets, lebenswichtigen Dauerfunktionen oder Zugriffsschutz.

## Zielfunktionen

Komfortabweichung und Unterversorgung, Luftqualität, nutzbare Betriebszeiten, Energie, Schalthäufigkeit und Materialbeanspruchung können Ziele sein. Manche Anlagen benötigen lückenlosen Betrieb. Ein unsicherer Hinweis auf Abwesenheit darf eine solche Zusage nicht aufheben. Die Zielfunktion darf harte Mindestfunktionen nicht für einen günstigeren Summenwert verletzen.

Training und Bewertung werden zeitlich getrennt. Vergleiche müssen Wetter, Nutzung, Messabdeckung und Konfigurationswechsel berücksichtigen. Eine Simulation oder Laufzeitverkürzung ist kein Nachweis real gesparter Energie. Energie wird nur bei geeigneter Messung als gemessen bezeichnet.

## Rolle eines Sprachmodells

Ein Sprachmodell kann Nutzerabsichten in die geprüfte Regelgrammatik übersetzen, Erkenntnisse erklären oder Kandidaten vorschlagen. Es bekommt keinen freien Datenpunkt-Schreiber und kein Betriebssystemwerkzeug. Webseiten, E-Mails, Kalendertexte und Modellantworten sind Daten, keine Ausführungsberechtigung.

Modellanbieter sind austauschbar. Lokale statistische Optimierung bildet einen vollautomatischen Referenzweg ohne externes Sprachmodell. Ein externer Anbieter benötigt eingerichtete Zugangsdaten und ein bewusst gesetztes Budget; kein Konto oder Abonnement wird vorausgesetzt. Anbieterfehler oder Budgetende lassen die letzte gültige klassische Steuerung weiterlaufen.

## Beobachtbarkeit und Rücknahme

Der Admin zeigt aktiven Modus, autorisierten Umfang, aktive gelernte Regeln, Gründe, Modellstand, nächste Bewertung und die Möglichkeit Pause/Rücknahme. Menschen können einzelne Geräte oder Funktionen dauerhaft vom Lernen ausschließen. Eine neue manuelle Vorgabe hat sofort den definierten Vorrang; ein altes Modell darf sie nicht beim nächsten Takt unbemerkt wieder überschreiben.

Alle Aktionspfade tragen Quell- und Planbezug. Ein neuer Modus, ein veralteter Vorschlag oder ein wiederholter Rückkanalauftrag erzeugt keine doppelte Geräteaktion. Rücknahme veralteter Pläne erhält zwischenzeitliche Nutzeränderungen.
