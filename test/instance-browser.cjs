const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function instanceBrowser(page, harness, root) {
	let statusRequests = 0;
	const statusListener = socket =>
		socket.on('framesent', ({ payload }) => {
			let message;
			try {
				message = JSON.parse(String(payload));
			} catch {
				return;
			}
			if (
				message[0] === 3 &&
				message[2] === 'sendTo' &&
				message[3]?.[0] === 'adaptivehome.0' &&
				message[3]?.[1] === 'status'
			) {
				statusRequests++;
			}
		});
	page.on('websocket', statusListener);
	const evidence = path.join(root, '.local/evidence/AP-05/instance-settings');
	fs.mkdirSync(evidence, { recursive: true });
	const own = await harness.objects.getObjectAsync('system.adapter.adaptivehome.0');
	const recordBefore = (await harness.states.getStateAsync('adaptivehome.0.configuration.record')).val;
	const nativeBefore = JSON.stringify(own.native);
	await harness.objects.setObjectAsync('system.adapter.shelly.7', {
		type: 'instance',
		common: { name: 'shelly', enabled: false, version: 'synthetic' },
		native: {},
	});
	await page.goto('http://127.0.0.1:18081/adapter/adaptivehome/index_m.html?0&react=modernDark');
	const frame = page.frameLocator('#setup-frame');
	await page.getByRole('heading', { name: 'Adaptive Home einrichten', exact: true }).waitFor();
	await frame.getByRole('heading', { name: /Guided setup|Geführte Einrichtung/, exact: true }).waitFor();
	assert.equal(await frame.locator('#instance').inputValue(), 'adaptivehome.0');
	assert.equal(await frame.locator('#instance').isDisabled(), true);
	await frame.locator('#language').selectOption('de');
	await frame.getByLabel('Name des Raums oder der Anlage', { exact: true }).fill('Anonymous studio');
	await frame.getByRole('button', { name: 'Bereich zum Entwurf hinzufügen', exact: true }).click();
	await frame.getByRole('button', { name: 'Installierte Adapter laden', exact: true }).click();
	await frame
		.getByLabel('Hersteller- oder Quellenadapter', { exact: true })
		.locator('option[value="shelly.7"]')
		.waitFor({ state: 'attached' });
	assert((await frame.getByLabel('Hersteller- oder Quellenadapter', { exact: true }).locator('option').count()) > 1);
	assert.equal((await harness.states.getStateAsync('adaptivehome.0.configuration.record')).val, recordBefore);
	assert.equal(JSON.stringify((await harness.objects.getObjectAsync(own._id)).native), nativeBefore);
	await page.locator('#show-technical').click();
	await page.locator('#native-sourceFiles').waitFor();
	assert.equal(JSON.parse(await page.locator('#native-sourceFiles').inputValue()) instanceof Object, true);
	assert.deepEqual(
		JSON.parse(await page.locator('#native-integrationProfiles').inputValue()),
		own.native.integrationProfiles || [],
	);
	// A native save cannot silently discard the independent runtime draft.
	const blocked = await page.evaluate(() => {
		let called = false;
		window.save(() => {
			called = true;
		});
		return { called, message: document.getElementById('native-message').textContent };
	});
	assert.equal(blocked.called, false);
	assert(/draft|entwurf/i.test(blocked.message));
	await page.locator('#show-setup').click();
	assert.equal(await frame.getByLabel('Name des Raums oder der Anlage', { exact: true }).count(), 1);
	for (const language of ['de', 'en']) {
		await frame.locator('#language').selectOption(language);
		await page.setViewportSize({ width: 390, height: 844 });
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		await frame.getByRole('textbox').first().focus();
		await page.keyboard.press('Tab');
		await page.screenshot({ path: path.join(evidence, `settings-${language}-390.png`), fullPage: true });
	}
	await page.setViewportSize({ width: 1280, height: 900 });
	await frame.locator('#language').selectOption('de');
	await page.screenshot({ path: path.join(evidence, 'settings-de-1280.png'), fullPage: true });
	await frame.locator('#reload').click();
	// An unavailable instance never falls back to the first existing instance.
	page.on('dialog', dialog => dialog.accept());
	await page.goto('http://127.0.0.1:18081/adapter/adaptivehome/tab_m.html?instance=99&embedded=1&lang=en');
	await page
		.locator('#message')
		.getByText('Adapter unavailable. Start the instance and reload.', { exact: true })
		.waitFor();
	assert.equal(await page.locator('#save').isDisabled(), true);
	assert.equal(await page.locator('#instance option').count(), 0);
	assert.equal((await harness.states.getStateAsync('adaptivehome.0.configuration.record')).val, recordBefore);
	await page.goto('http://127.0.0.1:18081/#tab-instances/config/system.adapter.adaptivehome.0');
	const native = page.frameLocator('iframe[src*="index_m.html"]');
	await native.locator('#setup-frame').waitFor({ timeout: 30000 });
	await native
		.frameLocator('#setup-frame')
		.getByRole('heading', { name: /Guided setup|Geführte Einrichtung/, exact: true })
		.waitFor();
	await native
		.frameLocator('#setup-frame')
		.getByRole('button', { name: /Load installed adapters|Installierte Adapter laden/, exact: true })
		.click();
	// Exercise one real refresh interval: editing needs configuration/catalogue, not live-status polling.
	await new Promise(resolve => setTimeout(resolve, 11000));
	assert.equal(statusRequests, 0);
	page.off('websocket', statusListener);
	await page.screenshot({ path: path.join(evidence, 'actual-instance-route.png'), fullPage: true });
	fs.writeFileSync(
		path.join(evidence, 'result.json'),
		JSON.stringify(
			{
				realAdmin: true,
				directInstanceForms: true,
				draftDoesNotActivate: true,
				nativeTypesPreserved: true,
				nativeSaveBlockedWithRuntimeDraft: true,
				noStatusPollingDuringSetup: true,
				missingInstanceDoesNotFallback: true,
				widths: [1280, 390],
				languages: ['de', 'en'],
			},
			null,
			2,
		),
	);
}
module.exports = { instanceBrowser };
