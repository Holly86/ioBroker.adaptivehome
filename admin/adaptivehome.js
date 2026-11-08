/* Authenticated ioBroker Admin tab; all actions use the adapter's validated message API. */
(() => {
	'use strict';
	const translations = {
		instance: ['Instance', 'Instanz'],
		language: ['Language', 'Sprache'],
		overview: ['Overview', 'Übersicht'],
		setup: ['Devices & areas', 'Geräte & Bereiche'],
		functions: ['Functions', 'Funktionen'],
		learning: ['Learning', 'Lernen'],
		learningEvidence: ['Learning evidence', 'Lernnachweise'],
		noModel: [
			'No qualified model yet; classical rules remain active.',
			'Noch kein geeignetes Modell; klassische Regeln bleiben aktiv.',
		],
		modelAdmitted: ['Model admitted', 'Modell zugelassen'],
		modelRejected: ['Model not admitted', 'Modell nicht zugelassen'],
		coverage: ['Data coverage', 'Datendeckung'],
		validSamples: ['Valid observations', 'Gültige Beobachtungen'],
		planStatus: ['Latest plan', 'Letzter Plan'],
		deviceReports: ['Confirmed device reports', 'Bestätigte Gerätemeldungen'],
		plan_suggestion: [
			'Awaiting acceptance or sufficient baseline',
			'Wartet auf Annahme oder ausreichende Ausgangsdaten',
		],
		plan_active: ['Active adaptation', 'Aktive Anpassung'],
		plan_evaluating: ['Evaluating observed effect', 'Gemessene Wirkung wird bewertet'],
		plan_verified: ['Evaluation passed', 'Bewertung bestanden'],
		plan_rolled_back: ['Rolled back', 'Zurückgenommen'],
		plan_paused: ['Paused', 'Pausiert'],
		plan_cancelled: ['Cancelled', 'Abgebrochen'],
		history: ['History & incidents', 'Verlauf & Störungen'],
		settings: ['Import & channels', 'Import & Kanäle'],
		preview: ['Validate draft', 'Entwurf prüfen'],
		save: ['Activate changes', 'Änderungen aktivieren'],
		reload: ['Reload', 'Neu laden'],
		rollback: ['Previous configuration', 'Vorige Konfiguration'],
		add: ['Add', 'Hinzufügen'],
		remove: ['Remove', 'Entfernen'],
		name: ['Name', 'Name'],
		kind: ['Kind', 'Art'],
		groups: ['Rooms / installations', 'Räume / Anlagen'],
		bindings: ['Device bindings', 'Gerätezuordnung'],
		id: ['Identifier', 'Kennung'],
		physicalId: ['Physical identity (one writer)', 'Physische Identität (ein Schreiber)'],
		integrationId: ['Integration', 'Anbindung'],
		backendVersion: ['Backend version', 'Backend-Version'],
		model: ['Device model', 'Gerätemodell'],
		family: ['Device family', 'Gerätefamilie'],
		confirmed: ['Identity and exclusive ownership verified', 'Identität und alleinige Zuständigkeit geprüft'],
		capabilities: ['Capabilities', 'Fähigkeiten'],
		capability: ['Capability', 'Fähigkeit'],
		readId: ['Read state ID', 'Datenpunkt zum Lesen'],
		writeId: ['Write state ID (optional)', 'Datenpunkt zum Schreiben (optional)'],
		confirmId: ['Feedback state ID', 'Datenpunkt zur Rückmeldung'],
		valueType: ['Value type', 'Werttyp'],
		unit: ['Unit', 'Einheit'],
		sourceUnit: ['Source unit', 'Quelleneinheit'],
		scale: ['Scale', 'Faktor'],
		offset: ['Offset', 'Versatz'],
		min: ['Minimum', 'Minimum'],
		max: ['Maximum', 'Maximum'],
		maxAgeMs: ['Maximum data age (ms)', 'Maximales Datenalter (ms)'],
		tolerance: ['Feedback tolerance', 'Rückmeldetoleranz'],
		confirmation: ['Feedback evidence', 'Rückmeldenachweis'],
		groupId: ['Room / installation', 'Raum / Anlage'],
		actuator: ['Actuator', 'Aktor'],
		operatingMode: ['Operating mode', 'Betriebsart'],
		enabled: ['Enabled', 'Aktiv'],
		inputs: ['Selected sources', 'Gewählte Quellen'],
		parameters: ['Everyday settings', 'Alltagseinstellungen'],
		rules: ['Rules & schedules', 'Regeln & Zeitpläne'],
		limits: ['Operating limits', 'Betriebsgrenzen'],
		essential: ['Essential minimum service', 'Unverzichtbare Mindestfunktion'],
		minimumValue: ['Minimum service value', 'Wert der Mindestfunktion'],
		minOnMs: ['Minimum on time (ms)', 'Mindestlaufzeit (ms)'],
		minOffMs: ['Minimum off time (ms)', 'Mindestruhezeit (ms)'],
		commandsPerHour: ['Commands per hour', 'Befehle pro Stunde'],
		manualHoldMs: ['Manual priority (ms)', 'Handvorrang (ms)'],
		block: ['Rule block', 'Regelbaustein'],
		conditions: ['Conditions (all must match)', 'Bedingungen (alle müssen zutreffen)'],
		input: ['Input', 'Quelle'],
		op: ['Comparison', 'Vergleich'],
		value: ['Value', 'Wert'],
		windows: ['Local time windows', 'Lokale Zeitfenster'],
		days: ['Days: 0 Sun – 6 Sat', 'Tage: 0 So – 6 Sa'],
		start: ['Start', 'Beginn'],
		end: ['End', 'Ende'],
		priority: ['Priority', 'Priorität'],
		validFrom: ['Valid from (UTC milliseconds)', 'Gültig ab (UTC-Millisekunden)'],
		expiresAt: ['Expires at (UTC milliseconds)', 'Gültig bis (UTC-Millisekunden)'],
		excludeDates: ['Excluded dates (YYYY-MM-DD)', 'Ausgenommene Tage (JJJJ-MM-TT)'],
		protection: ['Technical protection rules', 'Technische Schutzregeln'],
		when: ['Protection condition', 'Schutzbedingung'],
		autonomy: ['Learning permission', 'Lernfreigabe'],
		mode: ['Learning mode', 'Lernmodus'],
		granted: ['One-time permission for this function', 'Einmalige Freigabe für diese Funktion'],
		excluded: ['Exclude from learning', 'Vom Lernen ausschließen'],
		paused: ['Pause learning', 'Lernen pausieren'],
		blocks: ['Allowed rule blocks', 'Erlaubte Regelbausteine'],
		changesPerDay: ['Changes per day', 'Änderungen pro Tag'],
		evaluateAfterMs: ['Review after (ms)', 'Wirkungsprüfung nach (ms)'],
		minSamples: ['Minimum samples', 'Mindestzahl Messungen'],
		minCoverage: ['Minimum coverage (0–1)', 'Mindestabdeckung (0–1)'],
		maxGapMs: ['Maximum data gap (ms)', 'Maximale Datenlücke (ms)'],
		degradation: ['Rollback threshold', 'Rücknahmeschwelle'],
		objectives: ['Evaluation objectives', 'Bewertungsziele'],
		comfort: ['Comfort', 'Komfort'],
		energy: ['Energy', 'Energie'],
		switching: ['Switching frequency', 'Schalthäufigkeit'],
		timezone: ['Local time zone', 'Lokale Zeitzone'],
		notificationRoutes: ['Optional notification channels', 'Optionale Nachrichtenkanäle'],
		adapter: ['Channel instance', 'Kanalinstanz'],
		recipient: ['Recipient (not exported)', 'Empfänger (wird nicht exportiert)'],
		minimumSeverity: ['Minimum severity', 'Mindestschwere'],
		topics: ['Topics', 'Themen'],
		quiet: ['Quiet windows', 'Ruhezeiten'],
		sources: ['Optional context sources', 'Optionale Kontextquellen'],
		ref: ['Source capability', 'Quellenfähigkeit'],
		discover: ['Discover candidates', 'Gerätevorschläge suchen'],
		discoveryNote: [
			'Confirm physical identity, mappings and ownership before activation. Optional features require no account.',
			'Prüfe physische Identität, Zuordnung und Zuständigkeit vor der Aktivierung. Optionale Funktionen erfordern kein Konto.',
		],
		grantNote: [
			'Full mode may activate granted parameters and rule combinations without another dialog. Hard limits and manual control remain authoritative.',
			'Vollautomatik darf freigegebene Parameter und Regelkombinationen ohne weitere Rückfrage aktivieren. Harte Grenzen und Handbedienung bleiben maßgeblich.',
		],
		empty: [
			'No functions configured. Start with Devices & areas.',
			'Noch keine Funktionen eingerichtet. Beginne mit Geräte & Bereiche.',
		],
		ready: ['Ready', 'Bereit'],
		valid: ['Draft is valid', 'Entwurf ist gültig'],
		saved: ['Configuration activated', 'Konfiguration aktiviert'],
		unavailable: [
			'Adapter unavailable. Start the instance and reload.',
			'Adapter nicht erreichbar. Instanz starten und neu laden.',
		],
		conflict: [
			'Configuration changed elsewhere. Reload before applying.',
			'Die Konfiguration wurde anderweitig geändert. Bitte neu laden.',
		],
		import: ['Import configuration', 'Konfiguration importieren'],
		export: ['Export without recipients', 'Ohne Empfänger exportieren'],
		manual: ['Manual action', 'Handbedienung'],
		resume: ['Release manual priority', 'Handvorrang aufheben'],
		accept: ['Accept suggestion', 'Vorschlag annehmen'],
		pause: ['Pause adaptation', 'Anpassung pausieren'],
		cancel: ['Cancel adaptation', 'Anpassung abbrechen'],
		revert: ['Roll back adaptation', 'Anpassung zurücknehmen'],
		classic: ['Classic rules', 'Klassische Regeln'],
		observe: ['Observe', 'Beobachten'],
		suggest: ['Suggest', 'Vorschlagen'],
		bounded: ['Bounded automatic', 'Begrenzt automatisch'],
		full: ['Fully automatic', 'Vollautomatisch'],
		automatic: ['Automatic', 'Automatisch'],
		demand: ['Demand', 'Bedarf'],
		continuous: ['Continuous', 'Dauerbetrieb'],
		maintenance: ['Maintenance', 'Wartung'],
		lighting: ['Lighting', 'Licht'],
		climate: ['Climate', 'Klima'],
		air: ['Air quality', 'Luftqualität'],
		equipment: ['Equipment', 'Betriebsmittel'],
		room: ['Room', 'Raum'],
		installation: ['Installation', 'Anlage'],
		true: ['On / true', 'Ein / wahr'],
		false: ['Off / false', 'Aus / falsch'],
		holdMs: ['Motion hold time (ms)', 'Bewegungsnachlauf (ms)'],
		luxThreshold: ['Maximum illuminance (lx)', 'Maximale Helligkeit (lx)'],
		target: ['Target temperature', 'Solltemperatur'],
		setback: ['Base temperature', 'Basistemperatur'],
		threshold: ['Air quality threshold', 'Luftqualitätsschwelle'],
		high: ['High output', 'Hohe Leistung'],
		low: ['Low output', 'Niedrige Leistung'],
		hysteresis: ['Hysteresis', 'Hysterese'],
		motion: ['Motion', 'Bewegung'],
		lux: ['Illuminance', 'Helligkeit'],
		temperature: ['Temperature', 'Temperatur'],
		window: ['Window contact', 'Fensterkontakt'],
		airQuality: ['Air quality', 'Luftqualität'],
		presence: ['Presence', 'Anwesenheit'],
		power: ['Power', 'Leistung'],
		inhibit: ['Inhibit', 'Sperre'],
		parameterGrant: ['Permitted parameter ranges', 'Freigegebene Parameterbereiche'],
		scenes: ['Scenes', 'Szenen'],
		actions: ['Selected function actions', 'Gewählte Funktionsaktionen'],
		runScene: ['Run scene', 'Szene ausführen'],
		parameterName: ['Parameter name', 'Parametername'],
		inputName: ['Signal name', 'Signalname'],
		rawCode: ['Backend value', 'Backend-Wert'],
		valueMap: ['Value conversion', 'Wertumrechnung'],
		sourceType: ['Backend value type', 'Werttyp im Backend'],
		values: ['Allowed values (comma separated)', 'Zulässige Werte (mit Komma)'],
		codec: ['Conversion', 'Umrechnung'],
		allowedWindows: ['Hard operating windows', 'Harte Betriebszeitfenster'],
		dependencies: ['Required functions', 'Erforderliche Funktionen'],
		functionId: ['Function', 'Funktion'],
		requiredValue: ['Required value', 'Erforderlicher Wert'],
		resumeLearning: ['Resume learning', 'Lernen fortsetzen'],
		intervalMs: ['Interval duration (ms)', 'Intervalllänge (ms)'],
		onMs: ['Run time per interval (ms)', 'Laufzeit je Intervall (ms)'],
		anchorAt: ['Interval anchor (UTC milliseconds)', 'Intervallbeginn (UTC-Millisekunden)'],
		onValue: ['On output', 'Einschaltwert'],
		offValue: ['Off output', 'Ausschaltwert'],
		absenceConfirmMs: ['Absence confirmation (ms)', 'Abwesenheitsbestätigung (ms)'],
		presenceConfirmations: ['Independent presence confirmations', 'Unabhängige Anwesenheitsbestätigungen'],
		preheatMinutes: ['Heating lead (minutes)', 'Heizvorlauf (Minuten)'],
		responseMs: ['Room response review (ms)', 'Raumwirkung prüfen nach (ms)'],
		minimumRise: ['Minimum observed rise (°C)', 'Erwartete Mindesterwärmung (°C)'],
		scopes: ['Function identifiers', 'Funktionskennungen'],
		recovery: ['Send recovery notice', 'Entwarnung senden'],
		repeatMs: ['Retry delay (ms)', 'Abstand bis Wiederholung (ms)'],
		maxAttempts: ['Maximum send attempts', 'Maximale Versandversuche'],
		modelCandidate: ['Request optional model candidate', 'Optionalen Modellvorschlag anfordern'],
		revision: ['Revision', 'Revision'],
		none: ['None', 'Keine'],
		schedule: ['Schedule', 'Zeitplan'],
		sensor: ['Sensor', 'Sensor'],
		minimum: ['Baseline', 'Basisregel'],
		device: ['Documented device feedback', 'Dokumentierte Geräterückmeldung'],
		backend: ['Backend acknowledgement', 'Backend-Bestätigung'],
		desired: ['Requested target', 'Gewünschtes Ziel'],
		actual: ['Reported state', 'Gemeldeter Zustand'],
		age: ['Age (seconds)', 'Alter (Sekunden)'],
		quality: ['Data quality', 'Datengüte'],
		nextAction: ['Next action', 'Nächste Aktion'],
		details: ['Technical details', 'Technische Details'],
		quality_valid: ['Valid', 'Gültig'],
		invalidField: ['Check this field', 'Bitte dieses Feld prüfen'],
		checkTypeRange: [
			'Check the value type, required fields and operating limits.',
			'Prüfe Werttyp, Pflichtfelder und Betriebsgrenzen.',
		],
		dateFrom: ['Valid from (UTC)', 'Gültig ab (UTC)'],
		dateUntil: ['Valid until (UTC)', 'Gültig bis (UTC)'],
		motion_on: ['New movement under the light threshold', 'Neue Bewegung bei zulässiger Helligkeit'],
		motion_hold: ['Waiting for the quiet period', 'Der Bewegungsnachlauf läuft'],
		motion_active: ['Movement remains active', 'Bewegung ist weiterhin aktiv'],
		motion_quiet_expired: [
			'Quiet period completed for an automatically owned light',
			'Ruhezeit beendet; die Leuchte gehört noch zur Automatik',
		],
		no_new_motion: ['Waiting for new movement', 'Warten auf neue Bewegung'],
		externally_on: [
			'Already switched on externally; no automatic switch-off ownership',
			'Bereits anderweitig eingeschaltet; kein automatisches Ausschalten übernommen',
		],
		motion_unavailable: ['A fresh movement signal is missing', 'Ein frisches Bewegungssignal fehlt'],
		lux_unavailable: ['Illuminance is unavailable', 'Der Helligkeitswert fehlt'],
		too_bright: ['The measured area is bright enough', 'Der Bereich ist bereits hell genug'],
		manual_priority: ['A newer manual request has priority', 'Eine neue Handbedienung hat Vorrang'],
		minimum_service: [
			'Maintaining the essential minimum service',
			'Die zugesicherte Mindestfunktion bleibt erhalten',
		],
		technical_protection: [
			'A configured protection condition applies',
			'Eine eingerichtete Schutzbedingung greift',
		],
		heat_supply_unverified: [
			'Heat is requested; sufficient room warming has not been measured',
			'Wärme ist angefordert; eine ausreichende Erwärmung wurde noch nicht gemessen',
		],
		climate_target: ['The configured comfort target applies', 'Der eingerichtete Komfortsollwert gilt'],
		window_setback: ['The configured window setback applies', 'Die eingerichtete Fensterabsenkung gilt'],
		presence_setback: [
			'Confirmed absence applies the base target',
			'Bestätigte Abwesenheit aktiviert den Basissollwert',
		],
		air_demand_high: [
			'The configured air-quality threshold calls for higher output',
			'Die eingerichtete Luftqualitätsschwelle fordert mehr Leistung',
		],
		air_demand_low: ['The configured lower fan output applies', 'Die eingerichtete niedrige Lüfterstufe gilt'],
		air_quality_unknown: [
			'Air quality is unknown; device state is preserved',
			'Luftqualität unbekannt; der Gerätezustand bleibt erhalten',
		],
		rule_schedule: ['A configured time window applies', 'Ein eingerichtetes Zeitfenster gilt'],
		rule_sensor: ['A configured sensor rule applies', 'Eine eingerichtete Sensorregel gilt'],
		rule_minimum: ['A configured baseline rule applies', 'Eine eingerichtete Basisregel gilt'],
		inhibited: ['A configured inhibit is active', 'Eine eingerichtete Sperre ist aktiv'],
		command_budget: ['The command limit has been reached', 'Das Befehlsbudget ist erreicht'],
		device_uncertain_reconcile: [
			'Device execution is uncertain; read confirmation is required',
			'Geräteausführung unklar; eine neue Rückmeldung ist erforderlich',
		],
		outside_operating_window: [
			'Outside the permitted operating window',
			'Außerhalb des freigegebenen Betriebszeitfensters',
		],
		hard_limit: [
			'The requested value exceeds an operating limit',
			'Der gewünschte Wert verletzt eine Betriebsgrenze',
		],
		dependency_unconfirmed: [
			'A required function is not confirmed',
			'Eine erforderliche Funktion ist nicht bestätigt',
		],
	};
	let lang = navigator.language.startsWith('de') ? 'de' : 'en',
		page = 'overview',
		config,
		revision = 0,
		live = {},
		counter = 0;
	const $ = id => document.getElementById(id),
		t = key => translations[key]?.[lang === 'de' ? 1 : 0] || key;
	const node = (tag, text) => {
		const n = document.createElement(tag);
		if (text !== undefined) {
			n.textContent = text;
		}
		return n;
	};
	const uid = prefix => `${prefix}_${Date.now().toString(36)}_${++counter}`;
	const socket =
		typeof io === 'function'
			? io()
			: typeof io !== 'undefined' && typeof io.connect === 'function'
				? io.connect(window.location.origin)
				: null;
	const message = (text, error = false) => {
		$('message').textContent = text;
		$('message').className = error ? 'error' : '';
	};
	const run = fn =>
		Promise.resolve()
			.then(fn)
			.catch(e => {
				let text = t(e.message);
				try {
					const issues = JSON.parse(e.message);
					if (Array.isArray(issues)) {
						text = `${t('invalidField')}: ${issues[0].path
							.map(p => (typeof p === 'number' ? p + 1 : t(p)))
							.join(' → ')}. ${t('checkTypeRange')}`;
					}
				} catch {
					/* A known short reason code can be translated directly. */
				}
				message(text, true);
			});
	function request(command, data = {}) {
		return new Promise((resolve, reject) => {
			if (!socket || !$('instance').value) {
				return reject(new Error(t('unavailable')));
			}
			const timer = setTimeout(() => reject(new Error(t('unavailable'))), 10000);
			const mutations = [
				'applyConfiguration',
				'rollbackConfiguration',
				'manual',
				'resume',
				'reconcile',
				'clearHistory',
				'adaptation',
				'scene',
			];
			const payload = mutations.includes(command)
				? {
						...data,
						requestId: data.requestId || uid('request'),
						expectedRevision: data.expectedRevision ?? revision,
						expiresAt: Date.now() + 30000,
					}
				: data;
			socket.emit('sendTo', $('instance').value, command, payload, response => {
				clearTimeout(timer);
				response?.ok
					? resolve(response.result)
					: reject(
							new Error(
								response?.error === 'revision_conflict'
									? t('conflict')
									: response?.error || t('unavailable'),
							),
						);
			});
		});
	}
	function button(parent, label, action) {
		const b = node('button', t(label));
		b.type = 'button';
		b.addEventListener('click', () => run(action));
		parent.append(b);
		return b;
	}
	function field(parent, label, value, change, kind = 'text', choices) {
		const wrap = node('label'),
			caption = node('span', t(label)),
			input = node(choices ? 'select' : 'input');
		input.id = uid('field');
		caption.id = `${input.id}_label`;
		input.setAttribute('aria-labelledby', caption.id);
		if (choices) {
			for (const item of choices) {
				const option = node('option', t(typeof item === 'string' ? item : item.label));
				option.value = typeof item === 'string' ? item : item.value;
				input.append(option);
			}
		} else {
			input.type = kind;
		}
		if (kind === 'checkbox') {
			input.checked = !!value;
		} else {
			input.value = value ?? '';
		}
		input.addEventListener('change', () =>
			change(
				kind === 'checkbox'
					? input.checked
					: kind === 'number'
						? input.value === ''
							? undefined
							: Number(input.value)
						: input.value,
			),
		);
		wrap.append(caption, input);
		parent.append(wrap);
		return input;
	}
	function grid(parent) {
		const n = node('div');
		n.className = 'grid';
		parent.append(n);
		return n;
	}
	function section(label) {
		const n = node('section');
		n.append(node('h2', t(label)));
		$('main').append(n);
		return n;
	}
	const refOptions = writable => [
		{ value: '', label: 'none' },
		...(config?.bindings || []).flatMap(b =>
			b.capabilities
				.filter(c => !writable || c.writeId)
				.map(c => ({ value: `${b.id}:${c.capability}`, label: `${b.id} · ${c.capability}` })),
		),
	];
	const refValue = v => (v ? `${v.entityId}:${v.capability}` : '');
	const parseRef = v => {
		const [entityId, capability] = v.split(':');
		return { entityId, capability };
	};
	const descriptors = {
		area: { id: 'text', name: 'text', kind: ['room', 'installation'] },
		mapping: {
			capability: [
				'switch',
				'dimmer',
				'color',
				'temperatureSensor',
				'thermostatSetpoint',
				'windowContact',
				'motion',
				'illuminance',
				'power',
				'energy',
				'fan',
				'airQuality',
				'flow',
				'filterLife',
			],
			readId: 'text',
			writeId: 'text?',
			confirmId: 'text?',
			valueType: ['boolean', 'number', 'string'],
			unit: 'text',
			sourceUnit: 'text?',
			scale: 'number',
			offset: 'number',
			min: 'number?',
			max: 'number?',
			maxAgeMs: 'number',
			tolerance: 'number',
			confirmation: ['backend', 'device'],
			sourceType: ['boolean', 'number', 'string'],
			values: 'scalars',
			codec: ['identity', 'hueLightLevel'],
		},
		binding: {
			id: 'text',
			physicalId: 'text',
			integrationId: 'text',
			family: 'text',
			backendVersion: 'text',
			model: 'text',
			confirmed: 'checkbox',
		},
		limits: {
			min: 'number?',
			max: 'number?',
			essential: 'checkbox',
			minimumValue: 'scalar?',
			minOnMs: 'number',
			minOffMs: 'number',
			commandsPerHour: 'number',
			manualHoldMs: 'number',
		},
		rule: {
			id: 'text',
			enabled: 'checkbox',
			block: ['schedule', 'sensor', 'presence', 'minimum'],
			value: 'scalar',
			priority: 'number',
			validFrom: 'number?',
			expiresAt: 'number?',
			excludeDates: 'strings',
		},
		condition: { input: 'inputRef', op: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'], value: 'scalar' },
		window: { days: 'days', start: 'time', end: 'time' },
		autonomy: {
			mode: ['classic', 'observe', 'suggest', 'bounded', 'full'],
			granted: 'checkbox',
			excluded: 'checkbox',
			paused: 'checkbox',
			changesPerDay: 'number',
			evaluateAfterMs: 'number',
			minSamples: 'number',
			minCoverage: 'number',
			maxGapMs: 'number',
			degradation: 'number',
		},
		route: {
			id: 'text',
			adapter: 'text',
			recipient: 'text',
			minimumSeverity: ['info', 'warning', 'error'],
			topics: 'strings',
			scopes: 'strings',
			recovery: 'checkbox',
			repeatMs: 'number',
			maxAttempts: 'number',
		},
		source: { id: 'text', kind: ['weather', 'calendar', 'presence', 'energy', 'generic'] },
	};
	function form(parent, obj, descriptor, fn) {
		const cols = grid(parent);
		for (const [key, spec] of Object.entries(descriptor)) {
			if (Array.isArray(spec)) {
				field(
					cols,
					key,
					obj[key],
					v => {
						obj[key] = v;
					},
					'text',
					spec,
				);
				continue;
			}
			if (spec === 'inputRef') {
				field(cols, key, obj[key], v => (obj[key] = v), 'text', Object.keys(fn?.inputs || {}));
				continue;
			}
			if (['validFrom', 'expiresAt', 'anchorAt'].includes(key)) {
				field(
					cols,
					key === 'validFrom' ? 'dateFrom' : key === 'expiresAt' ? 'dateUntil' : key,
					obj[key] === undefined ? '' : new Date(obj[key]).toISOString().slice(0, 16),
					v => {
						if (v) {
							obj[key] = Date.parse(`${v}Z`);
						} else {
							delete obj[key];
						}
					},
					'datetime-local',
				);
				continue;
			}
			if (spec === 'scalar' || spec === 'scalar?') {
				const type = fn
					? config.bindings
							.find(b => b.id === fn.actuator.entityId)
							?.capabilities.find(m => m.capability === fn.actuator.capability)?.valueType
					: undefined;
				const infer = key === 'value' && obj.op ? typeof obj.value : type;
				if (infer === 'boolean') {
					field(cols, key, String(obj[key] ?? false), v => (obj[key] = v === 'true'), 'text', [
						'true',
						'false',
					]);
				} else {
					field(
						cols,
						key,
						obj[key],
						v => {
							if (v === '' && spec.endsWith('?')) {
								delete obj[key];
							} else {
								obj[key] =
									infer === 'number'
										? Number(v)
										: v === 'true'
											? true
											: v === 'false'
												? false
												: Number.isFinite(Number(v)) && v !== ''
													? Number(v)
													: v;
							}
						},
						'text',
					);
				}
				continue;
			}
			if (spec === 'days' || spec === 'strings' || spec === 'scalars') {
				field(
					cols,
					key,
					(obj[key] || []).join(','),
					v =>
						(obj[key] = v
							.split(',')
							.filter(Boolean)
							.map(x =>
								spec === 'days'
									? Number(x)
									: spec === 'scalars'
										? x.trim() === 'true'
											? true
											: x.trim() === 'false'
												? false
												: Number.isFinite(Number(x))
													? Number(x)
													: x.trim()
										: x.trim(),
							)),
				);
				continue;
			}
			const kind = spec.replace('?', '');
			field(
				cols,
				key,
				obj[key],
				v => {
					if ((v === undefined || v === '') && spec.endsWith('?')) {
						delete obj[key];
					} else {
						obj[key] = v;
						if (key === 'granted' && fn) {
							obj.capabilities = v ? [fn.actuator.capability] : [];
						}
					}
				},
				kind,
			);
		}
	}
	function repeat(parent, label, array, create, draw) {
		const details = node('details');
		details.open = true;
		details.append(node('summary', t(label)));
		array.forEach((obj, index) => {
			const group = node('fieldset');
			group.append(node('legend', obj.name || obj.id || String(index + 1)));
			draw(group, obj);
			button(group, 'remove', () => {
				array.splice(index, 1);
				render();
			});
			details.append(group);
		});
		button(details, 'add', () => {
			array.push(create());
			render();
		});
		parent.append(details);
	}
	function render() {
		document.documentElement.lang = lang;
		document.querySelectorAll('[data-t]').forEach(n => (n.textContent = t(n.dataset.t)));
		$('language').value = lang;
		$('navigation').replaceChildren();
		for (const key of ['overview', 'setup', 'functions', 'learning', 'history', 'settings']) {
			const b = button($('navigation'), key, () => {
				page = key;
				render();
			});
			b.setAttribute('aria-current', String(page === key));
		}
		$('main').replaceChildren();
		if (!config) {
			$('main').append(node('p', t('unavailable')));
			return;
		}
		({
			overview: overview,
			setup: setup,
			functions: functions,
			learning: learning,
			history: history,
			settings: settings,
		})[page]();
	}
	function overview() {
		const root = section('overview');
		for (const scene of config.scenes || []) {
			button(root, scene.name, async () => {
				const result = await request('scene', { sceneId: scene.id });
				message(JSON.stringify(result));
				await refresh();
			});
		}
		root.append(node('p', `${t('revision')}: ${revision}`));
		if (!config.functions.length) {
			root.append(node('p', t('empty')));
			button(root, 'setup', () => {
				page = 'setup';
				render();
			});
		}
		for (const fn of config.functions) {
			const card = node('article'),
				trace = live.traces?.[fn.id];
			card.append(
				node('h3', fn.name),
				node('p', `${t(fn.kind)} · ${t(fn.autonomy.mode)}`),
				node(
					'p',
					live.functions?.[fn.id]?.error ||
						(translations[trace?.reasonCode] ? t(trace.reasonCode) : trace?.reasonText) ||
						t('ready'),
				),
			);
			const values = grid(card);
			for (const [key, value] of [
				['desired', trace?.desiredValue],
				['actual', trace?.actual?.value],
			]) {
				values.append(
					node('p', `${t(key)}: ${typeof value === 'boolean' ? t(String(value)) : (value ?? '—')}`),
				);
			}
			for (const [name, observation] of Object.entries(trace?.inputs || {})) {
				if (observation) {
					values.append(
						node(
							'p',
							`${t(name)}: ${observation.value ?? '—'} ${observation.unit} · ${t('quality')}: ${t(
								`quality_${observation.quality}`,
							)} · ${t('age')}: ${Math.max(0, Math.floor((Date.now() - observation.measuredAt) / 1000))}`,
						),
					);
				}
			}
			if (trace?.nextStep) {
				card.append(node('p', `${t('nextAction')}: ${trace.nextStep}`));
			}
			const detail = node('details'),
				pre = node('pre');
			detail.append(node('summary', t('details')));
			pre.textContent = JSON.stringify(trace || {}, null, 2);
			detail.append(pre);
			card.append(detail);
			const actions = grid(card);
			let value = fn.parameters.target ?? false;
			form(
				actions,
				{
					get value() {
						return value;
					},
					set value(v) {
						value = v;
					},
				},
				{ value: 'scalar' },
				fn,
			);
			button(actions, 'manual', async () => {
				await request('manual', { functionId: fn.id, value, requestId: uid('manual') });
				await refresh();
			});
			button(actions, 'resume', async () => {
				await request('resume', { functionId: fn.id });
				await refresh();
			});
			root.append(card);
		}
	}
	function setup() {
		const root = section('setup');
		root.append(node('p', t('discoveryNote')));
		repeat(
			root,
			'groups',
			config.groups,
			() => ({ id: uid('area'), name: t('groups'), kind: 'room' }),
			(p, a) => form(p, a, descriptors.area),
		);
		button(root, 'discover', async () => {
			const candidates = await request('discover');
			for (const b of candidates) {
				const card = node('article');
				card.append(node('p', `${b.id} · ${b.integrationId} · ${(b.detectedTypes || []).join(', ')}`));
				button(card, 'add', () => {
					config.bindings.push({ ...b, confirmed: false });
					render();
				});
				root.append(card);
			}
		});
		repeat(
			root,
			'bindings',
			config.bindings,
			() => ({
				id: uid('device'),
				physicalId: '',
				integrationId: 'generic',
				family: 'generic',
				backendVersion: '1',
				model: 'unverified',
				confirmed: false,
				capabilities: [],
			}),
			(p, b) => {
				form(p, b, descriptors.binding);
				repeat(
					p,
					'capabilities',
					b.capabilities,
					() => ({
						capability: 'switch',
						readId: '',
						valueType: 'boolean',
						unit: '',
						scale: 1,
						offset: 0,
						maxAgeMs: 300000,
						tolerance: 0,
						confirmation: 'backend',
					}),
					(box, m) => {
						form(box, m, descriptors.mapping);
						const codes = document.createElement('details');
						codes.append(node('summary', t('valueMap')));
						for (const [raw, normalized] of Object.entries(m.valueMap || {})) {
							const row = grid(codes);
							let key = raw;
							field(row, 'rawCode', key, v => {
								const existing = m.valueMap[key];
								delete m.valueMap[key];
								key = v;
								m.valueMap[key] = existing;
							});
							field(
								row,
								'value',
								String(normalized),
								v =>
									(m.valueMap[key] =
										m.valueType === 'number'
											? Number(v)
											: m.valueType === 'boolean'
												? v === 'true'
												: v),
							);
							button(row, 'remove', () => {
								delete m.valueMap[key];
								render();
							});
						}
						button(codes, 'add', () => {
							m.valueMap ??= {};
							m.valueMap[uid('code')] =
								m.valueType === 'number' ? 0 : m.valueType === 'boolean' ? false : '';
							render();
						});
						box.append(codes);
					},
				);
			},
		);
	}
	const newFunction = () => ({
		id: uid('function'),
		name: t('functions'),
		groupId: config.groups[0]?.id || '',
		kind: 'lighting',
		enabled: true,
		operatingMode: 'demand',
		actuator: { entityId: '', capability: '' },
		inputs: {},
		rules: [],
		parameters: { holdMs: 300000, luxThreshold: 100 },
		limits: {
			essential: false,
			minOnMs: 0,
			minOffMs: 0,
			commandsPerHour: 30,
			manualHoldMs: 1800000,
			protection: [],
		},
		autonomy: {
			mode: 'classic',
			granted: false,
			parameters: {},
			capabilities: [],
			blocks: [],
			excluded: false,
			paused: false,
			minSamples: 48,
			minCoverage: 0.8,
			maxGapMs: 3600000,
			changesPerDay: 2,
			evaluateAfterMs: 3600000,
			degradation: 0.1,
			objectives: { comfort: 1, energy: 0, switching: 1 },
		},
	});
	function functions() {
		const root = section('functions');
		repeat(root, 'functions', config.functions, newFunction, (p, fn) => {
			const cols = grid(p);
			field(cols, 'name', fn.name, v => (fn.name = v));
			field(
				cols,
				'kind',
				fn.kind,
				v => {
					fn.kind = v;
					fn.parameters =
						v === 'lighting'
							? { holdMs: 300000, luxThreshold: 100 }
							: v === 'climate'
								? { target: 21, setback: 18 }
								: v === 'air'
									? { threshold: 25, high: 75, low: 25, hysteresis: 5 }
									: {};
					render();
				},
				'text',
				['lighting', 'climate', 'air', 'equipment'],
			);
			field(
				cols,
				'groupId',
				fn.groupId,
				v => (fn.groupId = v),
				'text',
				config.groups.map(a => ({ value: a.id, label: a.name })),
			);
			field(
				cols,
				'actuator',
				refValue(fn.actuator),
				v => {
					fn.actuator = parseRef(v);
					render();
				},
				'text',
				refOptions(true),
			);
			field(cols, 'operatingMode', fn.operatingMode, v => (fn.operatingMode = v), 'text', [
				'automatic',
				'demand',
				'continuous',
				'maintenance',
			]);
			field(cols, 'enabled', fn.enabled, v => (fn.enabled = v), 'checkbox');
			const inputBox = node('fieldset');
			inputBox.append(node('legend', t('inputs')));
			const inputGrid = grid(inputBox);
			const inputNames =
				fn.kind === 'lighting'
					? ['motion', 'lux', 'presence', 'inhibit']
					: fn.kind === 'climate'
						? ['temperature', 'window', 'presence', 'inhibit']
						: fn.kind === 'air'
							? ['airQuality', 'presence', 'power', 'inhibit']
							: ['presence', 'power', 'inhibit'];
			for (const key of new Set([...inputNames, ...Object.keys(fn.inputs)])) {
				field(
					inputGrid,
					key,
					refValue(fn.inputs[key]),
					v => {
						if (v) {
							fn.inputs[key] = parseRef(v);
						} else {
							delete fn.inputs[key];
						}
					},
					'text',
					refOptions(false),
				);
			}
			p.append(inputBox);
			let signalName = '';
			field(inputBox, 'inputName', '', v => (signalName = v));
			button(inputBox, 'add', () => {
				if (signalName) {
					fn.inputs[signalName] = { entityId: '', capability: '' };
					render();
				}
			});
			p.append(node('h3', t('parameters')));
			form(p, fn.parameters, Object.fromEntries(Object.keys(fn.parameters).map(k => [k, 'number'])), fn);
			const parameterRow = grid(p);
			let parameterName = '';
			field(parameterRow, 'parameterName', '', v => (parameterName = v));
			button(parameterRow, 'add', () => {
				if (parameterName) {
					fn.parameters[parameterName] = 0;
					render();
				}
			});
			p.append(node('h3', t('limits')));
			form(p, fn.limits, descriptors.limits, fn);
			fn.limits.allowedWindows ??= [];
			repeat(
				p,
				'allowedWindows',
				fn.limits.allowedWindows,
				() => ({ days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '00:00' }),
				(box, w) => form(box, w, descriptors.window),
			);
			fn.dependencies ??= [];
			repeat(
				p,
				'dependencies',
				fn.dependencies,
				() => ({ functionId: '', requiredValue: true, confirmation: 'device' }),
				(box, d) => {
					field(
						box,
						'functionId',
						d.functionId,
						v => (d.functionId = v),
						'text',
						config.functions
							.filter(other => other.id !== fn.id)
							.map(other => ({ value: other.id, label: other.name })),
					);
					form(box, d, { requiredValue: 'scalar', confirmation: ['backend', 'device'] }, fn);
				},
			);
			repeat(
				p,
				'protection',
				fn.limits.protection,
				() => ({ when: { input: Object.keys(fn.inputs)[0] || '', op: 'eq', value: true }, value: false }),
				(box, c) => {
					form(box, c.when, descriptors.condition, fn);
					form(box, c, { value: 'scalar' }, fn);
				},
			);
			repeat(
				p,
				'rules',
				fn.rules,
				() => ({
					id: uid('rule'),
					enabled: true,
					block: 'schedule',
					value:
						config.bindings
							.find(b => b.id === fn.actuator.entityId)
							?.capabilities.find(c => c.capability === fn.actuator.capability)?.valueType === 'boolean'
							? true
							: 0,
					priority: 40,
					windows: [],
					conditions: [],
					excludeDates: [],
				}),
				(box, r) => {
					form(box, r, descriptors.rule, fn);
					repeat(
						box,
						'windows',
						r.windows,
						() => ({ days: [0, 1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00' }),
						(w, item) => form(w, item, descriptors.window),
					);
					repeat(
						box,
						'conditions',
						r.conditions,
						() => ({ input: Object.keys(fn.inputs)[0] || '', op: 'eq', value: true }),
						(w, c) => form(w, c, descriptors.condition, fn),
					);
				},
			);
		});
	}
	function learning() {
		const root = section('learning'),
			note = node('p', t('grantNote'));
		note.className = 'warning';
		root.append(note);
		for (const fn of config.functions) {
			const p = node('fieldset');
			p.append(node('legend', fn.name));
			form(p, fn.autonomy, descriptors.autonomy, fn);
			const blocks = grid(p);
			for (const key of ['schedule', 'sensor', 'presence']) {
				field(
					blocks,
					key,
					fn.autonomy.blocks.includes(key),
					v => {
						fn.autonomy.blocks = fn.autonomy.blocks.filter(b => b !== key);
						if (v) {
							fn.autonomy.blocks.push(key);
						}
					},
					'checkbox',
				);
			}
			const params = node('fieldset');
			params.append(node('legend', t('parameterGrant')));
			for (const [key, value] of Object.entries(fn.parameters)) {
				const row = grid(params);
				field(
					row,
					key,
					!!fn.autonomy.parameters[key],
					v => {
						if (v) {
							fn.autonomy.parameters[key] = { min: value, max: value };
						} else {
							delete fn.autonomy.parameters[key];
						}
						render();
					},
					'checkbox',
				);
				if (fn.autonomy.parameters[key]) {
					form(row, fn.autonomy.parameters[key], { min: 'number', max: 'number' });
				}
			}
			p.append(params);
			form(p, fn.autonomy.objectives, { comfort: 'number', energy: 'number', switching: 'number' });
			// The selected actuator is the complete capability grant; no arbitrary state writer exists.
			fn.autonomy.capabilities = fn.autonomy.granted ? [fn.actuator.capability] : [];
			for (const action of ['accept', 'pause', 'cancel', 'revert']) {
				button(p, action, async () => {
					await request('adaptation', { functionId: fn.id, action, requestId: uid('adapt') });
					await refresh();
				});
			}
			button(p, 'resumeLearning', async () => {
				await request('adaptation', { functionId: fn.id, action: 'resume' });
				await refresh();
			});
			button(p, 'modelCandidate', async () => {
				const result = await request('modelCandidate', { functionId: fn.id });
				message(JSON.stringify(result));
			});
			const evidence = live.learning?.[fn.id] || {},
				model = evidence.models?.at(-1),
				plan = evidence.active || evidence.plans?.at(-1);
			p.append(node('h3', t('learningEvidence')));
			if (model) {
				p.append(node('p', t(model.admitted ? 'modelAdmitted' : 'modelRejected')));
				p.append(
					node(
						'p',
						`${t('coverage')}: ${Math.round(model.coverage * 100)} % · ${t('validSamples')}: ${model.validSamples}`,
					),
				);
			} else {
				p.append(node('p', t('noModel')));
			}
			if (plan) {
				p.append(node('p', `${t('planStatus')}: ${t(`plan_${plan.status}`)}`));
				p.append(node('p', `${t('deviceReports')}: ${plan.deviceConfirmations}`));
			}
			const details = node('details'),
				pre = node('pre');
			details.append(node('summary', t('details')));
			pre.textContent = JSON.stringify(evidence, null, 2);
			details.append(pre);
			p.append(details);
			root.append(p);
		}
	}
	function history() {
		const root = section('history'),
			pre = node('pre');
		pre.textContent = JSON.stringify({ incidents: live.incidents || [], history: live.history || [] }, null, 2);
		root.append(pre);
	}
	function settings() {
		const root = section('settings');
		config.scenes ??= [];
		repeat(
			root,
			'scenes',
			config.scenes,
			() => ({ id: uid('scene'), name: t('scenes'), actions: [] }),
			(box, scene) => {
				form(box, scene, { id: 'text', name: 'text' });
				repeat(
					box,
					'actions',
					scene.actions,
					() => ({ functionId: '', value: true }),
					(row, action) => {
						field(
							row,
							'functionId',
							action.functionId,
							v => {
								action.functionId = v;
								render();
							},
							'text',
							config.functions.map(fn => ({ value: fn.id, label: fn.name })),
						);
						form(
							row,
							action,
							{ value: 'scalar' },
							config.functions.find(fn => fn.id === action.functionId),
						);
					},
				);
			},
		);
		field(root, 'timezone', config.timezone, v => (config.timezone = v));
		const file = field(root, 'import', '', () => undefined, 'file');
		file.accept = '.json';
		file.addEventListener('change', () =>
			run(async () => {
				if (file.files[0].size > 2000000) {
					throw new Error('File too large');
				}
				config = await request('previewConfiguration', JSON.parse(await file.files[0].text()));
				render();
				message(t('valid'));
			}),
		);
		button(root, 'export', async () => {
			const value = await request('exportConfiguration'),
				url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })),
				a = node('a');
			a.href = url;
			a.download = 'adaptivehome-configuration.json';
			a.click();
			URL.revokeObjectURL(url);
		});
		repeat(
			root,
			'notificationRoutes',
			config.notificationRoutes,
			() => ({
				id: uid('route'),
				adapter: 'telegram.0',
				recipient: '',
				minimumSeverity: 'warning',
				topics: [],
				quiet: [],
			}),
			(p, r) => {
				form(p, r, descriptors.route);
				repeat(
					p,
					'quiet',
					r.quiet,
					() => ({ days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '07:00' }),
					(box, w) => form(box, w, descriptors.window),
				);
			},
		);
		repeat(
			root,
			'sources',
			config.sources,
			() => ({ id: uid('source'), kind: 'generic', ref: { entityId: '', capability: '' } }),
			(p, s) => {
				form(p, s, descriptors.source);
				field(p, 'ref', refValue(s.ref), v => (s.ref = parseRef(v)), 'text', refOptions(false));
			},
		);
	}
	async function refresh() {
		live = await request('status');
		if (page === 'overview' || page === 'history') {
			render();
		}
	}
	async function load() {
		const record = await request('getConfiguration');
		config = record.active;
		revision = config.revision;
		render();
		await refresh();
		message(t('ready'));
	}
	$('language').addEventListener('change', () => {
		lang = $('language').value;
		render();
		message(t(config ? 'ready' : 'unavailable'));
	});
	$('instance').addEventListener('change', () => run(load));
	$('preview').addEventListener('click', () =>
		run(async () => {
			config = await request('previewConfiguration', config);
			render();
			message(t('valid'));
		}),
	);
	$('save').addEventListener('click', () =>
		run(async () => {
			await request('applyConfiguration', { configuration: config, expectedRevision: revision });
			await load();
			message(t('saved'));
		}),
	);
	$('reload').addEventListener('click', () => run(load));
	$('rollback').addEventListener('click', () =>
		run(async () => {
			await request('rollbackConfiguration', { expectedRevision: revision });
			await load();
		}),
	);
	if (socket) {
		socket.on('connect', () =>
			socket.emit(
				'getObjectView',
				'system',
				'instance',
				{ startkey: 'system.adapter.adaptivehome.', endkey: 'system.adapter.adaptivehome.\u9999' },
				(error, result) => {
					if (error) {
						return message(String(error), true);
					}
					$('instance').replaceChildren();
					for (const row of result?.rows || []) {
						const option = node('option', row.id.replace('system.adapter.', ''));
						option.value = row.id.replace('system.adapter.', '');
						$('instance').append(option);
					}
					run(load);
				},
			),
		);
	}
	setInterval(() => {
		if (config && document.visibilityState === 'visible') {
			run(refresh);
		}
	}, 10000);
	render();
})();
