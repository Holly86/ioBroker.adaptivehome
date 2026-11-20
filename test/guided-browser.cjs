const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { referenceConfiguration } = require('../build/config/examples');
async function guidedBrowser(page, harness, root) {
	const help = await fetch('http://127.0.0.1:18081/adapter/adaptivehome/help.html');
	assert.equal(help.ok, true);
	assert.equal((await help.text()).includes('lang="de"'), true);
	const evidence = path.join(root, '.local/evidence/AP-05/guided-setup');
	fs.mkdirSync(evidence, { recursive: true });
	await harness.objects.setObjectAsync('system.adapter.shelly.8', {
		type: 'instance',
		common: { name: 'shelly', enabled: false, version: 'synthetic' },
		native: { password: 'fixture-not-returned' },
	});
	await harness.objects.setObjectAsync('system.adapter.sql.9', {
		type: 'instance',
		common: { name: 'sql', enabled: false, version: 'synthetic' },
		native: {},
	});
	for (const [channel, key, type, unit, writable, de, en] of [
		['relay', 'Switch', 'boolean', '', true, 'Teststeckdose', 'Test socket'],
		['motion', 'motion', 'boolean', '', false, 'Testbewegung', 'Test motion'],
		['lux', 'lux', 'number', 'lx', false, 'Testhelligkeit', 'Test illuminance'],
	]) {
		await harness.objects.setObjectAsync(`shelly.8.lab.${channel}`, {
			type: 'channel',
			common: { name: { de, en } },
			native: {},
		});
		await harness.objects.setObjectAsync(`shelly.8.lab.${channel}.${key}`, {
			type: 'state',
			common: { name: { de, en }, type, unit, read: true, write: writable },
			native: {},
		});
		await harness.states.setStateAsync(`shelly.8.lab.${channel}.${key}`, {
			val: type === 'boolean' ? false : 10,
			ack: true,
			ts: Date.now(),
		});
	}
	const empty = referenceConfiguration('apartment');
	empty.groups = [];
	empty.bindings = [];
	empty.functions = [];
	await page.locator('#language').selectOption('de');
	await page.getByRole('button', { name: 'Import & Kanäle', exact: true }).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'empty.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(empty)),
	});
	await page.getByText('Entwurf ist gültig', { exact: true }).waitFor();
	await page.locator('#save').click();
	await page.getByText('Konfiguration aktiviert', { exact: true }).waitFor();
	await page.getByRole('heading', { name: 'Geführte Einrichtung', exact: true }).waitFor();
	assert.equal(await page.getByLabel('Was soll geschehen?', { exact: true }).count(), 0);
	const startRecord = JSON.parse((await harness.states.getStateAsync('adaptivehome.0.configuration.record')).val);
	await page.getByLabel('Name des Raums oder der Anlage', { exact: true }).fill('Studio');
	await page.getByLabel('Zeitzone für Zeitpläne', { exact: true }).selectOption('Europe/Paris');
	await page.getByRole('button', { name: 'Bereich zum Entwurf hinzufügen', exact: true }).click();
	await page.getByRole('button', { name: 'Installierte Adapter laden', exact: true }).click();
	await page.getByLabel('Hersteller- oder Quellenadapter', { exact: true }).selectOption('shelly.8');
	await page.getByRole('button', { name: 'Geräte in diesem Adapter suchen', exact: true }).click();
	for (const [name, alias, control] of [
		['Testbewegung', 'Bewegung', false],
		['Testhelligkeit', 'Helligkeit', false],
		['Teststeckdose', 'Prüfleuchte', true],
	]) {
		const select = page.getByLabel('Erkanntes Gerät oder Quelle', { exact: true });
		const option = select.locator('option').filter({ hasText: name });
		await option.waitFor({ state: 'attached' });
		await select.selectOption(await option.getAttribute('value'));
		await page.getByLabel('Dein Gerätename', { exact: true }).fill(alias);
		if (control) {
			await page.getByLabel('Geplante Verwendung', { exact: true }).selectOption('prepare');
			await page.getByRole('button', { name: 'Gerät zum Entwurf hinzufügen', exact: true }).click();
			await page
				.getByText('Vor dem Vorbereiten der Steuerung Identität und Zuständigkeit prüfen.', { exact: true })
				.waitFor();
			await page
				.getByRole('checkbox', {
					name: 'Ich habe Gerät, Rückmeldung und alleinige Steuerzuständigkeit geprüft',
					exact: true,
				})
				.check();
		}
		await page.getByRole('button', { name: 'Gerät zum Entwurf hinzufügen', exact: true }).click();
		await page.getByText('Zum Entwurf hinzugefügt; noch nichts aktiviert.', { exact: true }).waitFor();
	}
	await page.getByLabel('Name der Funktion', { exact: true }).fill('Studiolicht');
	assert.deepEqual(
		await page
			.getByLabel('Was soll geschehen?', { exact: true })
			.locator('option')
			.evaluateAll(options => options.map(o => o.value)),
		['lighting', 'equipment'],
	);
	await page.getByLabel('Raum oder Anlage', { exact: true }).selectOption({ label: 'Studio' });
	await page.getByLabel('Zu steuerndes Gerät', { exact: true }).selectOption({ label: 'Prüfleuchte' });
	await page.getByLabel('Bewegungsmelder', { exact: true }).selectOption({ label: 'Bewegung' });
	await page.getByLabel('Helligkeitssensor', { exact: true }).selectOption({ label: 'Helligkeit (lx)' });
	await page.getByLabel('Ausschalten nach Ruhe (Minuten)', { exact: true }).fill('20');
	await page.getByLabel('Ausschalten nach Ruhe (Minuten)', { exact: true }).press('Tab');
	await page.getByRole('button', { name: 'Deaktivierte Funktion zum Entwurf hinzufügen', exact: true }).click();
	const unchanged = JSON.parse((await harness.states.getStateAsync('adaptivehome.0.configuration.record')).val);
	assert.equal(unchanged.active.revision, startRecord.active.revision);
	assert.equal(unchanged.active.functions.length, 0);
	await page.getByLabel('Vorhandener SQL-Adapter', { exact: true }).selectOption('sql.9');
	await page.getByRole('checkbox', { name: 'Adaptive-Home-Daten in SQL speichern', exact: true }).check();
	assert.equal(await page.getByRole('checkbox', { name: 'Beobachtungen speichern', exact: true }).isEnabled(), true);
	await page.getByRole('checkbox', { name: 'Adaptive-Home-Daten in SQL speichern', exact: true }).uncheck();
	await page.locator('#preview').click();
	await page.getByText('Entwurf ist gültig', { exact: true }).waitFor();
	for (const language of ['de', 'en']) {
		await page.locator('#language').selectOption(language);
		await page.setViewportSize({ width: 390, height: 844 });
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await page
			.getByRole('textbox', {
				name: language === 'de' ? 'Name des Raums oder der Anlage' : 'Room or installation name',
				exact: true,
			})
			.focus();
		await page.keyboard.press('Tab');
		await page.screenshot({ path: path.join(evidence, `guided-${language}-390.png`), fullPage: true });
	}
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.locator('#language').selectOption('de');
	await page.screenshot({ path: path.join(evidence, 'guided-de-1280.png'), fullPage: true });
	await page.getByRole('button', { name: 'Import & Kanäle', exact: true }).click();
	await page.locator('summary').filter({ hasText: 'Erweiterte Konfiguration (JSON)' }).click();
	const editor = page.getByRole('textbox', { name: 'Erweiterte Konfiguration (JSON)', exact: true });
	const draft = JSON.parse(await editor.inputValue());
	draft.functions[0].limits.manualHoldMs = 2400000;
	draft.logging.maxQueued = 777;
	await editor.fill('{broken');
	await page.getByRole('button', { name: 'JSON prüfen und als Entwurf übernehmen', exact: true }).click();
	await page
		.getByText('Ungültige JSON-Schreibweise. Der bisherige Entwurf bleibt erhalten.', { exact: true })
		.waitFor();
	await page.locator('#save').click();
	await page.getByText('JSON-Änderungen zuerst übernehmen oder verwerfen.', { exact: true }).waitFor();
	await editor.fill(JSON.stringify(draft));
	await page.getByRole('button', { name: 'JSON prüfen und als Entwurf übernehmen', exact: true }).click();
	await page.getByText('Entwurf ist gültig', { exact: true }).waitFor();
	await page.locator('summary').filter({ hasText: 'Erweiterte Konfiguration (JSON)' }).click();
	const stale = JSON.parse(await editor.inputValue());
	stale.functions[0].name = 'Stale JSON';
	await editor.fill(JSON.stringify(stale));
	await page.getByRole('button', { name: 'Geführte Einrichtung', exact: true }).click();
	await page.getByLabel('Name des Raums oder der Anlage', { exact: true }).fill('Second area');
	await page.getByRole('button', { name: 'Bereich zum Entwurf hinzufügen', exact: true }).click();
	await page.getByRole('button', { name: 'Import & Kanäle', exact: true }).click();
	await page.locator('summary').filter({ hasText: 'Erweiterte Konfiguration (JSON)' }).click();
	await page.getByRole('button', { name: 'JSON prüfen und als Entwurf übernehmen', exact: true }).click();
	await page
		.getByText(
			'Der Formularentwurf wurde seit dem Öffnen dieses JSON geändert. JSON separat sichern und danach aus dem aktuellen Entwurf neu laden.',
			{ exact: true },
		)
		.waitFor();
	await page.getByRole('button', { name: 'JSON durch aktuellen Formularentwurf ersetzen', exact: true }).click();
	await page.locator('#save').click();
	await page.getByText('Konfiguration aktiviert', { exact: true }).waitFor();
	const saved = JSON.parse((await harness.states.getStateAsync('adaptivehome.0.configuration.record')).val).active;
	assert.equal(saved.functions[0].enabled, false);
	assert.equal(saved.functions[0].parameters.holdMs, 1200000);
	assert.equal(saved.functions[0].limits.manualHoldMs, 2400000);
	assert.equal(saved.logging.maxQueued, 777);
	assert.equal(saved.timezone, 'Europe/Paris');
	assert.equal(saved.groups.length, 2);
	assert.equal(saved.functions[0].name, 'Studiolicht');
	assert.equal(saved.bindings.find(b => b.name === 'Bewegung').confirmed, false);
	assert.equal((await harness.states.getStateAsync('shelly.8.lab.relay.Switch')).ack, true);
	fs.writeFileSync(
		path.join(evidence, 'result.json'),
		JSON.stringify(
			{
				realAdmin: true,
				syntheticDevices: true,
				languages: ['de', 'en'],
				widths: [1280, 390],
				newFunctionsDisabled: true,
				jsonRoundtrip: true,
				invalidJsonPreservesDraft: true,
				staleJsonPreservesFormChanges: true,
				sqlInstanceSelection: true,
				publicInstalledPackage: false,
			},
			null,
			2,
		),
	);
}
module.exports = { guidedBrowser };
