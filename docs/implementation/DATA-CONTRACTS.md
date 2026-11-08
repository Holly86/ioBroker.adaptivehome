# Verbindliche Datenverträge

Die folgenden Verträge sind fachliche Anforderungen. AP-03 und AP-04 überführen sie in tatsächliche TypeScript-Typen und Laufzeitvalidierung. Zusätzliche Felder benötigen eine dokumentierte Versionierung; beliebige JSON-Felder werden nicht ungeprüft zu ausführbaren Aktionen.

## Beobachtung

Jede Beobachtung trägt entityId, capability, value, unit, measuredAt, receivedAt, quality, sourceId und optional observationId. Qualität unterscheidet valid, unknown, stale, invalid und unavailable. Fehlende oder ungültige Werte sind nicht false oder zero. Für unveränderte Werte werden lastChange, letzte echte Messung und Verbindungsgesundheit getrennt berücksichtigt.

## Gerätebindung

Eine DeviceBinding enthält stabile Geräteidentität, integrationId, Gerätefamilie, Anbindungsversion, Rollen, zulässige Datenpunkte, Fähigkeiten mit read/write/confirm, Umrechnung, zulässige Werte, bekannte Grenzen und Prüfstatus. Derselbe physische Ausgang erhält keinen zweiten unkoordinierten Schreibpfad. Eine neue Anbindung wird erst nach Prüfung ihrer Identität aktiv.

## Konfiguration

Eine ConfigurationRevision umfasst schemaVersion, revision, parentRevision, createdAt, actor, Herkunft, Räume/Anlagen, Funktionsinstanzen, Quellen, Betriebsgrenzen und Lernfreigaben. Entwurf, validierte Aktivierung und tatsächlich angewandte Revision sind unterscheidbar. Import ist atomar oder wird vollständig verworfen. Export enthält standardmäßig weder Tokens noch Empfängeridentitäten oder persönliche Beobachtungen.

## Regel und Absicht

Eine Regel benutzt eine endliche deklarative Grammatik aus Auslösern, Bedingungen, Fristen, Aktionen und Ausnahmen. Keine freien JavaScript-, Shell- oder SQL-Ausdrücke. Eine Intent trägt intentId, entityId, capability, typedValue, origin, actor, reasonCode, reasonText, sourceSnapshotId, configRevision, priority, validFrom und expiresAt. Für Pläne kommen explizite lokale Zeitregeln und native Gerätefähigkeiten hinzu.

origin unterscheidet manual, configured_rule, learned_policy und recovery. Eine Menschenhandlung wird nie allein deshalb als solche klassifiziert, weil eine eigene Profilübernahme kurz einen abweichenden Wert meldet. Bestätigte unabhängige Raumzustände laufen während einer lokalen Übernahme weiter.

## Befehl und Wirkung

Ein Command enthält commandId, intentId, Ausführungsgeneration, eindeutigen Zielpfad, bestätigten Gerätebezug, Sollwert, Frist, Idempotenzschlüssel und erwarteten Rückmeldevertrag. Ein CommandResult trennt dispatchAccepted, feedbackMatched, deviceConfirmed, Wirkung und uncertainty. Ein geschriebener ack-Wert ist nicht automatisch ein physischer Nachweis.

Ein DecisionTrace verbindet Eingangswerte und Alter, aktive Regeln, abgelehnte Alternativen, Betriebsgrenzen, tatsächliche Ausführung und verbleibenden nächsten Schritt. Bereinigte Texte sind im Admin verständlich. Rohdaten und Geheimnisse erscheinen nicht in öffentlichen Logs.

## Autonomieprofil

Ein AutonomyProfile enthält mode, freigegebene Funktionsinstanzen und Fähigkeiten, erlaubte Parameter und Regelbausteine, harte Grenzen, Datenqualitätsminimum, Bewertungsziele, Änderungs- und Schaltbudgets, Modellzulassung, Rücknahmebedingungen und pause/cancel. Vollautomatisch darf innerhalb dieser Freigabe neue gültige Pläne und Regelkombinationen aktivieren. Unbekannte Hersteller, neue Risikofunktionen oder unbeschränkte Schreibrechte entstehen daraus nicht.

## Modell und Optimierung

Eine ModelVersion nennt Modelltyp, Merkmals- und Datensatzschema, Trainingszeitraum, Datenabdeckung, ausgelassene Lücken, zeitlich getrennte Bewertung, Baseline und Zulassungsstatus. Konfidenz muss sich auf ein geprüftes Verfahren beziehen; keine durch Sprachmodelle frei erfundene Prozentzahl.

Ein AdaptationPlan trägt planId, Funktionsumfang, Ausgangsrevision, Modellversion, Datenbezug, vorgeschlagene Parameter/Regeln, erwartete Wirkung, harte Prüfungen, Aktivierungsmodus, Ablauf oder Überprüfung sowie Rückweg. Der Aktivierungsnachweis enthält angenommene Revision, Gerätebestätigungen, tatsächliche Wirkung und gegebenenfalls Rücknahmegrund.

## Störung und Nachrichten

Ein Incident besitzt incidentId, dedupKey, betroffenen Umfang, Ursache, Schweregrad, Status, Beobachtungszeit, Auswirkungen und berechtigte Aktionen. Eine NotificationRoute legt explizite Kanalinstanz, Empfänger, Themen, Schweregrade und Ruhezeiten fest. Angefordert, vom Kanal angenommen und tatsächlich bestätigte Zustellung werden unterschieden, soweit der Kanal diese Nachweise liefert.

## Herstellervertrag und Erweiterung

Das IntegrationManifest benennt API-Version, Integrationskennung, unterstützte Backend-/Geräteversionen, Fähigkeiten, Erkennung, erforderliche Berechtigungen und Prüfmatrix. Ein Herstellerplugin darf weder fremde Konfiguration noch das Modelljournal verändern. Das gemeinsame Vertragstestpaket prüft Lesen, Einheiten, fehlende Werte, Handbedienung, Rückmeldung, Limits, Neuverbindung und unerwartete Antworten.
