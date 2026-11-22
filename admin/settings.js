/* ioBroker instance settings. The shared setup edits the revisioned draft; native fields stay optional. */
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = api;
	} else {
		api.mount(root);
	}
})(typeof window === 'undefined' ? globalThis : window, function () {
	'use strict';
	const fields = {
		sourceFiles: ['object', 'Readable source files (JSON object)', 'Lesbare Quelldateien (JSON-Objekt)'],
		sourceEndpoints: [
			'jsonString',
			'Protected Hue/Shelly access (JSON, hidden)',
			'Geschützte Hue-/Shelly-Zugänge (JSON, verborgen)',
		],
		integrationProfiles: [
			'array',
			'Trusted manufacturer profiles (JSON list)',
			'Vertrauenswürdige Herstellerprofile (JSON-Liste)',
		],
		controlClients: [
			'array',
			'Trusted control clients (JSON list)',
			'Vertrauenswürdige Bedienclients (JSON-Liste)',
		],
		controlSecret: ['secret', 'Optional gateway signing secret', 'Optionaler Gateway-Signaturschlüssel'],
		modelProvider: [
			'nullableObject',
			'Optional model provider (JSON object or null)',
			'Optionaler Modellanbieter (JSON-Objekt oder null)',
		],
		modelToken: ['secret', 'Optional model-provider token', 'Optionales Zugangstoken des Modellanbieters'],
	};
	const words = {
		title: ['Set up Adaptive Home', 'Adaptive Home einrichten'],
		intro: [
			'Rooms, devices and everyday settings with forms.',
			'Räume, Geräte und Alltagseinstellungen mit Formularen.',
		],
		setup: ['Setup', 'Einrichtung'],
		technical: ['Technical connections', 'Technische Anbindungen'],
		help: ['Help', 'Hilfe'],
		draftHint: [
			'Validate your draft and explicitly activate it inside the form.',
			'Den Entwurf im Formular prüfen und anschließend ausdrücklich aktivieren.',
		],
		technicalHint: [
			'Optional special connections. Manufacturer accounts stay in their existing adapters. Saving technical changes may restart this instance.',
			'Optionale Spezialanbindungen. Herstellerkonten bleiben bei ihren vorhandenen Adaptern. Das Speichern technischer Änderungen kann diese Instanz neu starten.',
		],
		pending: [
			'First activate or discard the setup draft in Setup.',
			'Zuerst den Einrichtungsentwurf unter Einrichtung aktivieren oder verwerfen.',
		],
		invalid: ['Check the highlighted field. Expected: ', 'Das markierte Feld prüfen. Erwartet: '],
		frame: ['Adaptive Home setup', 'Adaptive Home einrichten'],
	};
	const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
	const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
	function display(value, kind) {
		if (kind === 'secret' || kind === 'jsonString') {
			return value ?? '';
		}
		return JSON.stringify(value ?? (kind === 'array' ? [] : kind === 'nullableObject' ? null : {}), null, 2);
	}
	function parse(value, kind) {
		if (kind === 'secret') {
			return value;
		}
		const parsed = JSON.parse(value || (kind === 'array' ? '[]' : kind === 'nullableObject' ? 'null' : '{}'));
		if (
			kind === 'array'
				? !Array.isArray(parsed)
				: kind === 'nullableObject' && parsed === null
					? false
					: !isObject(parsed)
		) {
			throw Error(kind);
		}
		if (kind === 'object' && Object.values(parsed).some(v => typeof v !== 'string')) {
			throw Error('object');
		}
		return kind === 'jsonString' ? value : parsed;
	}
	function changes(settings, edited) {
		const changed = {};
		for (const [key, value] of Object.entries(edited)) {
			const kind = fields[key]?.[0];
			if (!kind) {
				throw Error('unknown_native_field');
			}
			// Untouched values, including optional nulls and encrypted fields, never get rewritten.
			if (value !== display(settings[key], kind)) {
				const next = parse(value, kind);
				if (!equal(next, settings[key])) {
					changed[key] = next;
				}
			}
		}
		return changed;
	}
	function mount(win) {
		const doc = win.document;
		let initial,
			notify,
			language = 'en',
			runtimeDirty = false;
		const controls = {};
		const t = key => words[key][language === 'de' ? 1 : 0];
		const nativeDirty = () =>
			Object.keys(controls).some(key => controls[key].value !== display(initial[key], fields[key][0]));
		const changed = () => notify?.(runtimeDirty || nativeDirty());
		const show = technical => {
			doc.getElementById('setup-panel').hidden = technical;
			doc.getElementById('technical-panel').hidden = !technical;
			doc.body.classList.toggle('settings-guided', !technical);
			doc.getElementById('show-setup').setAttribute('aria-pressed', String(!technical));
			doc.getElementById('show-technical').setAttribute('aria-pressed', String(technical));
		};
		win.load = (settings, onChange) => {
			initial = structuredClone(settings);
			notify = onChange;
			language = (win.systemConfig?.common?.language || win.navigator.language).startsWith('de') ? 'de' : 'en';
			doc.documentElement.lang = language;
			doc.querySelectorAll('[data-settings-text]').forEach(n => (n.textContent = t(n.dataset.settingsText)));
			const container = doc.getElementById('technical-fields');
			container.replaceChildren();
			for (const [key, [kind, en, de]] of Object.entries(fields)) {
				const label = doc.createElement('label'),
					caption = doc.createElement('span');
				caption.textContent = language === 'de' ? de : en;
				const input = doc.createElement(kind === 'secret' || kind === 'jsonString' ? 'input' : 'textarea');
				if (input.tagName === 'INPUT') {
					input.type = 'password';
					input.autocomplete = 'new-password';
				}
				input.id = `native-${key}`;
				input.value = display(settings[key], kind);
				input.spellcheck = false;
				input.addEventListener('input', changed);
				controls[key] = input;
				label.append(caption, input);
				container.append(label);
			}
			const frame = doc.getElementById('setup-frame');
			const url = new URL('tab_m.html', win.location.href);
			url.search = new URLSearchParams({
				instance: String(win.instance),
				embedded: '1',
				lang: language,
				theme: win.theme || '',
			});
			frame.title = t('frame');
			frame.setAttribute('aria-label', t('frame'));
			// A native import must not discard a separate unsaved runtime draft.
			if (!frame.hasAttribute('src')) {
				frame.src = url.href;
			}
			doc.getElementById('show-setup').onclick = () => show(false);
			doc.getElementById('show-technical').onclick = () => show(true);
			changed();
		};
		win.save = callback => {
			const message = doc.getElementById('native-message');
			message.textContent = '';
			if (runtimeDirty) {
				message.textContent = t('pending');
				return;
			}
			const edited = {};
			for (const [key, input] of Object.entries(controls)) {
				input.removeAttribute('aria-invalid');
				edited[key] = input.value;
				try {
					if (input.value !== display(initial[key], fields[key][0])) {
						parse(input.value, fields[key][0]);
					}
				} catch {
					input.setAttribute('aria-invalid', 'true');
					message.textContent = t('invalid') + fields[key][language === 'de' ? 2 : 1];
					input.focus();
					return;
				}
			}
			callback(changes(initial, edited));
		};
		win.addEventListener('message', event => {
			if (
				event.origin !== win.location.origin ||
				event.source !== doc.getElementById('setup-frame')?.contentWindow ||
				event.data?.type !== 'adaptivehome-draft'
			) {
				return;
			}
			runtimeDirty = event.data.dirty === true;
			changed();
		});
	}
	return { fields, display, parse, changes, mount };
});
