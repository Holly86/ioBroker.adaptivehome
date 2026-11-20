/* Guided setup builds a draft only. Activation remains the revision-checked Admin action. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = api;
	} else {
		root.AdaptiveHomeSetup = api;
	}
})(typeof window === 'undefined' ? globalThis : window, function () {
	'use strict';
	const clone = value => JSON.parse(JSON.stringify(value));
	const text = {
		intro: [
			'Connect the devices already provided by your ioBroker adapters. Changes stay in the draft until you validate and activate them.',
			'Verbinde die Geräte deiner vorhandenen ioBroker-Adapter. Änderungen bleiben im Entwurf, bis du sie prüfst und aktivierst.',
		],
		help: ['Setup guide (also available offline)', 'Einrichtungsanleitung (auch offline verfügbar)'],
		areas: ['1 · Rooms and installations', '1 · Räume und Anlagen'],
		areaName: ['Room or installation name', 'Name des Raums oder der Anlage'],
		areaKind: ['Type of area', 'Art des Bereichs'],
		room: ['Room', 'Raum'],
		installation: ['Installation', 'Anlage'],
		timezone: ['Time zone for schedules', 'Zeitzone für Zeitpläne'],
		addArea: ['Add area to draft', 'Bereich zum Entwurf hinzufügen'],
		sources: ['2 · Connect existing devices', '2 · Vorhandene Geräte verbinden'],
		catalog: ['Load installed adapters', 'Installierte Adapter laden'],
		adapter: ['Manufacturer or source adapter', 'Hersteller- oder Quellenadapter'],
		choose: ['Please select', 'Bitte auswählen'],
		stopped: ['stopped', 'gestoppt'],
		configured: ['enabled', 'aktiviert'],
		catalogNote: [
			'Enabled describes the adapter setting, not fresh device data. Start and configure a missing adapter in ioBroker first. No new manufacturer account is created here.',
			'Aktiviert beschreibt die Instanzeinstellung, keine frischen Gerätewerte. Fehlende Adapter zuerst in ioBroker installieren und einrichten. Hier wird kein neues Herstellerkonto angelegt.',
		],
		scan: ['Find devices in this adapter', 'Geräte in diesem Adapter suchen'],
		noDevices: [
			'No supported candidates found. Check the adapter and model compatibility, or use the advanced device mapping.',
			'Keine unterstützten Vorschläge gefunden. Adapter und Modellkompatibilität prüfen oder die erweiterte Gerätezuordnung verwenden.',
		],
		device: ['Detected device or source', 'Erkanntes Gerät oder Quelle'],
		deviceName: ['Your device name', 'Dein Gerätename'],
		use: ['Intended use', 'Geplante Verwendung'],
		read: ['Read data only', 'Nur Daten lesen'],
		prepare: ['Prepare a controllable device', 'Steuerbares Gerät vorbereiten'],
		owner: [
			'I checked the physical device, feedback and sole control responsibility',
			'Ich habe Gerät, Rückmeldung und alleinige Steuerzuständigkeit geprüft',
		],
		readNote: [
			'Reading does not take over a device. Preparing a controllable device also leaves every new function disabled.',
			'Lesen übernimmt kein Gerät. Auch beim Vorbereiten eines steuerbaren Geräts bleibt jede neue Funktion deaktiviert.',
		],
		addDevice: ['Add device to draft', 'Gerät zum Entwurf hinzufügen'],
		included: ['Devices already in the draft', 'Bereits im Entwurf enthaltene Geräte'],
		missingOutput: [
			'Add a suitable controllable device above to see its function templates.',
			'Oben ein passendes steuerbares Gerät hinzufügen, um seine Funktionsvorlagen zu sehen.',
		],
		sqlMissing: ['not found in the loaded adapter list', 'in der geladenen Adapterliste nicht gefunden'],
		technical: ['Source data points and capabilities', 'Quelldatenpunkte und Fähigkeiten'],
		functions: ['3 · Prepare an everyday function', '3 · Alltagsfunktion vorbereiten'],
		functionNote: [
			'First add sensors and a controllable device above. New functions are disabled and use classic rules. Review their limits in Functions before explicitly enabling them. Learning mode Observe does not stop classic rules.',
			'Zuerst oben Sensoren und ein steuerbares Gerät hinzufügen. Neue Funktionen sind deaktiviert und verwenden klassische Regeln. Grenzen unter Funktionen prüfen und erst danach bewusst einschalten. Der Lernmodus Beobachten stoppt klassische Regeln nicht.',
		],
		functionName: ['Function name', 'Name der Funktion'],
		template: ['What should happen?', 'Was soll geschehen?'],
		lighting: ['Light following motion', 'Licht bei Bewegung'],
		climate: ['Room temperature', 'Raumtemperatur'],
		air: ['Fan following air quality', 'Lüfter nach Luftqualität'],
		equipment: ['Scheduled socket or light', 'Steckdose oder Licht nach Zeitplan'],
		area: ['Room or installation', 'Raum oder Anlage'],
		actuator: ['Device to control', 'Zu steuerndes Gerät'],
		motion: ['Motion sensor', 'Bewegungsmelder'],
		lux: ['Illuminance sensor', 'Helligkeitssensor'],
		temperature: ['Measured temperature', 'Gemessene Temperatur'],
		window: ['Window contact (optional)', 'Fensterkontakt (optional)'],
		airQuality: ['Air-quality sensor', 'Luftqualitätssensor'],
		hold: ['Switch off after quiet (minutes)', 'Ausschalten nach Ruhe (Minuten)'],
		threshold: ['Only switch on below (lux)', 'Nur einschalten unter (Lux)'],
		target: ['Comfort temperature (°C)', 'Komforttemperatur (°C)'],
		setback: ['Setback temperature (°C)', 'Absenktemperatur (°C)'],
		airThreshold: ['Air-quality threshold (sensor unit)', 'Luftqualitätsschwelle (Sensoreinheit)'],
		low: ['Low fan output (%)', 'Niedrige Lüfterleistung (%)'],
		high: ['High fan output (%)', 'Hohe Lüfterleistung (%)'],
		start: ['Start time', 'Beginn'],
		end: ['End time', 'Ende'],
		days: ['Days', 'Wochentage'],
		day0: ['Sunday', 'Sonntag'],
		day1: ['Monday', 'Montag'],
		day2: ['Tuesday', 'Dienstag'],
		day3: ['Wednesday', 'Mittwoch'],
		day4: ['Thursday', 'Donnerstag'],
		day5: ['Friday', 'Freitag'],
		day6: ['Saturday', 'Samstag'],
		equipmentNote: [
			'This template is for loads that may switch off. Essential continuous equipment needs an explicit minimum service and protection settings in the advanced function form.',
			'Diese Vorlage ist für abschaltbare Verbraucher. Unverzichtbarer Dauerbetrieb benötigt eine ausdrückliche Mindestfunktion und Schutzregeln im erweiterten Funktionsformular.',
		],
		addFunction: ['Add disabled function to draft', 'Deaktivierte Funktion zum Entwurf hinzufügen'],
		storage: ['4 · Optional data logging', '4 · Optionale Datenprotokollierung'],
		sql: ['Existing SQL adapter', 'Vorhandener SQL-Adapter'],
		logging: ['Store Adaptive Home data in SQL', 'Adaptive-Home-Daten in SQL speichern'],
		observations: ['Store observations', 'Beobachtungen speichern'],
		events: ['Store generated events', 'Erzeugte Ereignisse speichern'],
		sqlNote: [
			'SQL is optional and configured in its own adapter. This stores Adaptive Home records through that adapter; it does not enable history on other device states. InfluxDB is not a supported export target here.',
			'SQL ist optional und wird im eigenen Adapter eingerichtet. Gespeichert werden Adaptive-Home-Datensätze über diesen Adapter; fremde Gerätedatenpunkte erhalten keine Historienfreigabe. InfluxDB ist hier kein unterstütztes Exportziel.',
		],
		review: ['5 · Review your draft', '5 · Entwurf prüfen'],
		draft: ['Draft: areas / devices / functions', 'Entwurf: Bereiche / Geräte / Funktionen'],
		reviewNote: [
			'Validate draft checks the configuration without applying it. Activate changes saves the entire draft; existing enabled functions continue under the changed configuration. Newly prepared functions stay disabled. A valid draft is not hardware acceptance.',
			'Entwurf prüfen kontrolliert die Konfiguration ohne Übernahme. Änderungen aktivieren speichert den gesamten Entwurf; bereits aktive Funktionen laufen mit der geänderten Konfiguration weiter. Neu vorbereitete Funktionen bleiben deaktiviert. Ein gültiger Entwurf ist keine Geräteabnahme.',
		],
		added: ['Added to draft; nothing activated yet.', 'Zum Entwurf hinzugefügt; noch nichts aktiviert.'],
		setup_name_required: ['Enter a name.', 'Bitte einen Namen eingeben.'],
		setup_device_exists: [
			'This device is already configured. Edit its existing mapping in Devices & areas.',
			'Dieses Gerät ist bereits eingerichtet. Bestehende Zuordnung unter Geräte & Bereiche bearbeiten.',
		],
		setup_ownership_required: [
			'Check identity and control responsibility before preparing writes.',
			'Vor dem Vorbereiten der Steuerung Identität und Zuständigkeit prüfen.',
		],
		setup_selection_required: [
			'Select an area, suitable device and required sensor inputs.',
			'Bereich, passendes Gerät und erforderliche Sensoren auswählen.',
		],
		setup_value_invalid: [
			'Check the entered values, limits and selected days.',
			'Werte, Betriebsgrenzen und gewählte Tage prüfen.',
		],
		setup_output_owned: [
			'This physical output already has a function. Edit that function instead.',
			'Dieser physische Ausgang hat bereits eine Funktion. Bitte diese Funktion bearbeiten.',
		],
		setup_context_changed: [
			'The instance or configuration changed. Reload the candidates.',
			'Instanz oder Konfiguration hat sich geändert. Vorschläge neu laden.',
		],
	};
	function named(value) {
		if (typeof value !== 'string' || !value.trim() || value.trim().length > 128) {
			throw Error('setup_name_required');
		}
		return value.trim();
	}
	function nextId(config, prefix) {
		const ids = new Set([...config.groups, ...config.bindings, ...config.functions].map(x => x.id));
		let n = 1;
		while (ids.has(`${prefix}_${n}`)) {
			n++;
		}
		return `${prefix}_${n}`;
	}
	function addArea(config, name, kind) {
		if (!['room', 'installation'].includes(kind)) {
			throw Error('setup_selection_required');
		}
		const draft = clone(config);
		draft.groups.push({ id: nextId(draft, 'area'), name: named(name), kind });
		return draft;
	}
	function addDevice(config, candidate, name, writable, reviewed) {
		if (!candidate?.capabilities?.length) {
			throw Error('setup_selection_required');
		}
		const identities = new Set([candidate.physicalId, ...(candidate.memberPhysicalIds || [])]);
		if (
			config.bindings.some(
				b =>
					b.id === candidate.id ||
					[b.physicalId, ...(b.memberPhysicalIds || [])].some(id => identities.has(id)),
			)
		) {
			throw Error('setup_device_exists');
		}
		if (writable && (!reviewed || !candidate.capabilities.some(m => m.writeId && m.confirmId))) {
			throw Error('setup_ownership_required');
		}
		const draft = clone(config),
			binding = clone(candidate);
		binding.name = named(name);
		binding.confirmed = !!writable;
		if (!writable) {
			for (const m of binding.capabilities) {
				delete m.writeId;
				delete m.writeValues;
			}
		}
		draft.bindings.push(binding);
		return draft;
	}
	function refs(config, capability, writable = false) {
		const expectedType = ['switch', 'motion', 'windowContact'].includes(capability) ? 'boolean' : 'number';
		return config.bindings.flatMap(b =>
			b.capabilities
				.filter(
					m =>
						m.capability === capability &&
						m.valueType === expectedType &&
						(!writable || m.codec !== 'nativeHeatingProgram') &&
						(!writable || (b.confirmed && m.writeId && m.confirmId && m.confirmation !== 'none')) &&
						(!writable ||
							capability !== 'switch' ||
							((!m.writeValues || [true, false].every(v => m.writeValues.includes(v))) &&
								(!m.values || [true, false].every(v => m.values.includes(v))))) &&
						(capability !== 'fan' || !writable || (m.valueType === 'number' && m.unit === '%')) &&
						(!['switch', 'motion', 'windowContact'].includes(capability) || m.valueType === 'boolean'),
				)
				.map(m => ({
					value: `${b.id}:${m.capability}`,
					label: `${b.name || b.id}${m.unit ? ` (${m.unit})` : ''}`,
				})),
		);
	}
	function resolve(config, value, capability, writable) {
		if (!refs(config, capability, writable).some(r => r.value === value)) {
			throw Error('setup_selection_required');
		}
		const [entityId, cap] = value.split(':');
		return { entityId, capability: cap };
	}
	function number(value, min, max) {
		if (!Number.isFinite(value) || value < min || value > max) {
			throw Error('setup_value_invalid');
		}
		return value;
	}
	function addFunction(config, options) {
		const { kind } = options,
			capabilities = { lighting: 'switch', climate: 'thermostatSetpoint', air: 'fan', equipment: 'switch' };
		if (!capabilities[kind] || !config.groups.some(g => g.id === options.groupId)) {
			throw Error('setup_selection_required');
		}
		const actuator = resolve(config, options.actuator, capabilities[kind], true),
			binding = config.bindings.find(b => b.id === actuator.entityId);
		const mapping = binding.capabilities.find(m => m.capability === actuator.capability);
		if (
			config.functions.some(
				f => config.bindings.find(b => b.id === f.actuator.entityId)?.physicalId === binding.physicalId,
			)
		) {
			throw Error('setup_output_owned');
		}
		const fn = {
			id: nextId(config, 'function'),
			name: named(options.name),
			groupId: options.groupId,
			kind,
			enabled: false,
			operatingMode: kind === 'equipment' ? 'automatic' : 'demand',
			actuator,
			inputs: {},
			parameters: {},
			rules: [],
			limits: {
				essential: false,
				minOnMs: 0,
				minOffMs: 0,
				commandsPerHour: 30,
				manualHoldMs: 1800000,
				protection: [],
			},
			autonomy: { mode: 'classic', granted: false },
		};
		if (kind === 'lighting') {
			fn.inputs.motion = resolve(config, options.motion, 'motion');
			fn.inputs.lux = resolve(config, options.lux, 'illuminance');
			fn.parameters = {
				holdMs: Math.round(number(options.hold, 1 / 60, 1440) * 60000),
				luxThreshold: number(options.threshold, 0, 200000),
			};
		} else if (kind === 'climate') {
			fn.inputs.temperature = resolve(config, options.temperature, 'temperatureSensor');
			if (options.window) {
				fn.inputs.window = resolve(config, options.window, 'windowContact');
			}
			fn.parameters = { target: number(options.target, 5, 30), setback: number(options.setback, 5, 30) };
			if (fn.parameters.setback > fn.parameters.target) {
				throw Error('setup_value_invalid');
			}
			fn.limits.min = Math.max(5, mapping.min ?? 5);
			fn.limits.max = Math.min(30, mapping.max ?? 30);
		} else if (kind === 'air') {
			fn.inputs.airQuality = resolve(config, options.airQuality, 'airQuality');
			fn.parameters = {
				threshold: number(options.airThreshold, 0, 100000),
				low: number(options.low, 0, 100),
				high: number(options.high, 0, 100),
				hysteresis: 5,
			};
			if (fn.parameters.low > fn.parameters.high) {
				throw Error('setup_value_invalid');
			}
			fn.limits.min = Math.max(0, mapping.min ?? 0);
			fn.limits.max = Math.min(100, mapping.max ?? 100);
		} else {
			if (
				!options.days?.length ||
				options.days.some(d => !Number.isInteger(d) || d < 0 || d > 6) ||
				!/^([01]\d|2[0-3]):[0-5]\d$/.test(options.start) ||
				!/^([01]\d|2[0-3]):[0-5]\d$/.test(options.end) ||
				options.start === options.end
			) {
				throw Error('setup_value_invalid');
			}
			fn.rules = [
				{ id: 'base', block: 'minimum', value: false, priority: 1 },
				{
					id: 'schedule',
					block: 'schedule',
					value: true,
					priority: 50,
					windows: [{ days: [...new Set(options.days)], start: options.start, end: options.end }],
				},
			];
		}
		for (const key of ['target', 'setback', 'low', 'high']) {
			if (fn.parameters[key] !== undefined) {
				number(fn.parameters[key], fn.limits.min, fn.limits.max);
				if (
					(mapping.writeValues ?? mapping.values) &&
					!(mapping.writeValues ?? mapping.values).includes(fn.parameters[key])
				) {
					throw Error('setup_value_invalid');
				}
			}
		}
		const draft = clone(config);
		draft.functions.push(fn);
		return draft;
	}
	let state = {};
	function draw(h) {
		const { config, lang, root, node, field, button, grid, request } = h,
			t = key => text[key]?.[lang === 'de' ? 1 : 0] || key;
		if (state.base !== config) {
			state = {
				base: config,
				catalog: [],
				candidates: [],
				backend: '',
				candidate: '',
				use: 'read',
				reviewed: false,
				kind: 'lighting',
				options: {
					hold: 5,
					threshold: 100,
					target: 21,
					setback: 18,
					airThreshold: 25,
					low: 25,
					high: 75,
					days: [1, 2, 3, 4, 5],
					start: '08:00',
					end: '18:00',
				},
			};
		}
		const redraw = () => h.redraw(),
			apply = draft => {
				state.base = draft;
				h.replaceDraft(draft);
				h.message(t('added'));
			},
			part = key => {
				const box = node('article');
				box.append(node('h3', t(key)));
				root.append(box);
				return box;
			},
			f = (box, key, value, change, type = 'text', choices) => field(box, t(key), value, change, type, choices),
			b = (box, key, action) =>
				button(box, t(key), async () => {
					try {
						await action();
					} catch (e) {
						throw Error(t(e.message));
					}
				}),
			choices = values => [{ value: '', label: t('choose') }, ...values];
		root.append(node('p', t('intro')));
		const help = node('a', t('help'));
		help.href = `help.html#${lang === 'de' ? 'de' : 'en'}`;
		help.target = '_blank';
		help.rel = 'noopener noreferrer';
		root.append(help);
		const areas = part('areas'),
			ag = grid(areas);
		f(ag, 'areaName', state.areaName, v => (state.areaName = v));
		f(
			ag,
			'areaKind',
			state.areaKind || 'room',
			v => (state.areaKind = v),
			'text',
			['room', 'installation'].map(k => ({ value: k, label: t(k) })),
		);
		const zones = [...new Set([config.timezone, 'UTC', ...(Intl.supportedValuesOf?.('timeZone') || [])])];
		f(ag, 'timezone', config.timezone, v => (config.timezone = v), 'text', zones);
		b(areas, 'addArea', () => {
			const draft = addArea(config, state.areaName, state.areaKind || 'room');
			state.areaName = '';
			apply(draft);
		});
		areas.append(node('p', config.groups.map(g => g.name).join(' · ')));
		const sources = part('sources');
		b(sources, 'catalog', async () => {
			const result = await request('setupCatalog');
			if (!h.isCurrent()) {
				throw Error('setup_context_changed');
			}
			state.catalog = result;
			redraw();
		});
		sources.append(node('p', t('catalogNote')));
		f(
			sources,
			'adapter',
			state.backend,
			v => {
				state.backend = v;
				state.candidates = [];
				state.candidate = '';
				state.reviewed = false;
				redraw();
			},
			'text',
			choices(
				state.catalog
					.filter(x => x.profiles.length)
					.map(x => ({
						value: x.instance,
						label: `${x.instance} · ${x.profiles.map(p => p.name).join(', ')} · ${t(x.enabled ? 'configured' : 'stopped')}`,
					})),
			),
		);
		const scan = b(sources, 'scan', async () => {
			const backend = state.backend,
				found = await request('discover', { instance: backend, language: lang });
			if (!h.isCurrent() || state.backend !== backend) {
				throw Error('setup_context_changed');
			}
			state.candidates = found;
			state.candidate = '';
			state.scanned = true;
			redraw();
		});
		scan.disabled = !state.backend;
		if (state.scanned && !state.candidates.length) {
			sources.append(node('p', t('noDevices')));
		}
		f(
			sources,
			'device',
			state.candidate,
			v => {
				state.candidate = v;
				state.deviceName = '';
				state.reviewed = false;
				state.use = 'read';
				redraw();
			},
			'text',
			choices(state.candidates.map(c => ({ value: c.id, label: `${c.name || c.id} · ${c.model}` }))),
		);
		const candidate = state.candidates.find(c => c.id === state.candidate);
		if (candidate) {
			const g = grid(sources);
			f(g, 'deviceName', state.deviceName, v => (state.deviceName = v));
			f(
				g,
				'use',
				state.use,
				v => {
					state.use = v;
					state.reviewed = false;
					redraw();
				},
				'text',
				[
					{ value: 'read', label: t('read') },
					...(candidate.capabilities.some(m => m.writeId && m.confirmId)
						? [{ value: 'prepare', label: t('prepare') }]
						: []),
				],
			);
			if (state.use === 'prepare') {
				f(sources, 'owner', state.reviewed, v => (state.reviewed = v), 'checkbox');
			}
			sources.append(node('p', t('readNote')));
			const details = node('details');
			details.append(node('summary', t('technical')));
			for (const m of candidate.capabilities) {
				details.append(node('p', `${m.capability}: ${m.readId} (${m.valueType}, ${m.unit || '—'})`));
			}
			sources.append(details);
			b(sources, 'addDevice', () =>
				apply(addDevice(config, candidate, state.deviceName, state.use === 'prepare', state.reviewed)),
			);
		}
		if (config.bindings.length) {
			sources.append(node('h4', t('included')));
			const list = node('ul');
			for (const device of config.bindings) {
				list.append(
					node(
						'li',
						`${device.name || device.id} · ${device.integrationId} · ${t(device.confirmed && device.capabilities.some(m => m.writeId) ? 'prepare' : 'read')}`,
					),
				);
			}
			sources.append(list);
		}
		const functions = part('functions'),
			fg = grid(functions),
			o = state.options;
		functions.append(node('p', t('functionNote')));
		const kinds = ['lighting', 'climate', 'air', 'equipment'].filter(
			kind =>
				refs(
					config,
					{ lighting: 'switch', climate: 'thermostatSetpoint', air: 'fan', equipment: 'switch' }[kind],
					true,
				).length,
		);
		if (!kinds.length) {
			functions.append(node('p', t('missingOutput')));
		} else {
			if (!kinds.includes(state.kind)) {
				state.kind = kinds[0];
			}
			f(fg, 'functionName', o.name, v => (o.name = v));
			f(
				fg,
				'area',
				o.groupId || '',
				v => (o.groupId = v),
				'text',
				choices(config.groups.map(g => ({ value: g.id, label: g.name }))),
			);
			f(
				fg,
				'template',
				state.kind,
				v => {
					state.kind = v;
					o.actuator = '';
					redraw();
				},
				'text',
				kinds.map(k => ({ value: k, label: t(k) })),
			);
			f(
				fg,
				'actuator',
				o.actuator || '',
				v => (o.actuator = v),
				'text',
				choices(
					refs(
						config,
						{ lighting: 'switch', climate: 'thermostatSetpoint', air: 'fan', equipment: 'switch' }[
							state.kind
						],
						true,
					),
				),
			);
			const sensor = (key, cap) =>
				f(fg, key, o[key] || '', v => (o[key] = v), 'text', choices(refs(config, cap)));
			const numeric = (key, min, max) => {
				const input = f(fg, key, o[key], v => (o[key] = v), 'number');
				input.min = min;
				input.max = max;
				input.step = 'any';
			};
			if (state.kind === 'lighting') {
				sensor('motion', 'motion');
				sensor('lux', 'illuminance');
				numeric('hold', 1 / 60, 1440);
				numeric('threshold', 0, 200000);
			} else if (state.kind === 'climate') {
				sensor('temperature', 'temperatureSensor');
				sensor('window', 'windowContact');
				numeric('target', 5, 30);
				numeric('setback', 5, 30);
			} else if (state.kind === 'air') {
				sensor('airQuality', 'airQuality');
				numeric('airThreshold', 0, 100000);
				numeric('low', 0, 100);
				numeric('high', 0, 100);
			} else {
				functions.append(node('p', t('equipmentNote')));
				f(fg, 'start', o.start, v => (o.start = v), 'time');
				f(fg, 'end', o.end, v => (o.end = v), 'time');
				const days = node('fieldset');
				days.append(node('legend', t('days')));
				functions.append(days);
				for (let day = 0; day < 7; day++) {
					f(
						days,
						`day${day}`,
						o.days.includes(day),
						checked => {
							o.days = checked ? [...o.days, day] : o.days.filter(d => d !== day);
						},
						'checkbox',
					);
				}
			}
			b(functions, 'addFunction', () => apply(addFunction(config, { ...o, kind: state.kind })));
		}
		const storage = part('storage');
		storage.append(node('p', t('sqlNote')));
		f(
			storage,
			'sql',
			config.logging.adapter,
			v => {
				config.logging.adapter = v;
				redraw();
			},
			'text',
			choices(
				[
					...new Set([
						config.logging.adapter,
						...state.catalog.filter(x => x.instance.startsWith('sql.')).map(x => x.instance),
					]),
				]
					.filter(Boolean)
					.map(x => ({
						value: x,
						label: state.catalog.some(c => c.instance === x) ? x : `${x} · ${t('sqlMissing')}`,
					})),
			),
		);
		for (const [label, key] of [
			['logging', 'enabled'],
			['observations', 'observations'],
			['events', 'events'],
		]) {
			const input = f(
				storage,
				label,
				config.logging[key],
				v => {
					config.logging[key] = v;
					redraw();
				},
				'checkbox',
			);
			input.disabled =
				key === 'enabled'
					? !config.logging.enabled && !state.catalog.some(c => c.instance === config.logging.adapter)
					: !config.logging.enabled;
		}
		const review = part('review');
		review.append(
			node(
				'p',
				`${t('draft')}: ${config.groups.length} / ${config.bindings.length} / ${config.functions.length}`,
			),
			node('p', t('reviewNote')),
		);
	}
	return { addArea, addDevice, addFunction, refs, draw };
});
