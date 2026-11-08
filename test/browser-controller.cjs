const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { referenceConfiguration } = require('../build/config/examples');
const { seed, emulator, until, delay } = require('./controller-suite.cjs');
function defineBrowserTests({ suite }) {
	if (process.env.ADAPTIVEHOME_BROWSER !== '1') {
		return;
	}
	suite('S35 real ioBroker Admin browser workflows', getHarness => {
		it('configures all three reference cases in English/German with keyboard and narrow layout', async function () {
			this.timeout(180000);
			const harness = getHarness(),
				root = path.resolve(__dirname, '..'),
				adminDir =
					process.env.ADAPTIVEHOME_ADMIN_DIR ||
					path.join(root, '.local/admin-runtime/node_modules/iobroker.admin');
			const controllerDir = path.join(
				os.tmpdir(),
				'test-iobroker.adaptivehome/node_modules/iobroker.js-controller',
			);
			const link = path.join(path.dirname(adminDir), 'iobroker.js-controller');
			if (
				fs.existsSync(link) &&
				fs.lstatSync(link).isSymbolicLink() &&
				path.resolve(fs.realpathSync(link)) !== path.resolve(controllerDir)
			) {
				fs.unlinkSync(link);
			}
			if (!fs.existsSync(link)) {
				fs.symlinkSync(controllerDir, link, process.platform === 'win32' ? 'junction' : 'dir');
			}
			const adminLink = path.join(path.dirname(controllerDir), 'iobroker.admin');
			if (path.resolve(adminLink) !== path.resolve(adminDir) && !fs.existsSync(adminLink)) {
				fs.symlinkSync(adminDir, adminLink, process.platform === 'win32' ? 'junction' : 'dir');
			}
			const pkg = JSON.parse(fs.readFileSync(path.join(adminDir, 'package.json'), 'utf8')),
				ioPkg = JSON.parse(fs.readFileSync(path.join(adminDir, 'io-package.json'), 'utf8'));
			await harness.objects.setObjectAsync('system.adapter.admin.0', {
				type: 'instance',
				common: { ...ioPkg.common, name: 'admin', enabled: true, host: os.hostname(), loglevel: 'warn' },
				native: {
					...ioPkg.native,
					bind: '127.0.0.1',
					port: 18081,
					auth: false,
					secure: false,
					defaultUser: 'admin',
					autoUpdate: 0,
					telemetry: false,
				},
			});
			for (const file of ['tab_m.html', 'tab.html', 'adaptivehome.js', 'adaptivehome.css', 'adaptivehome.svg']) {
				await harness.objects.writeFileAsync(
					'adaptivehome.admin',
					file,
					fs.readFileSync(path.join(root, 'admin', file)),
				);
			}
			const all = ['apartment', 'aquarium', 'air'].map((name, index) =>
				process.env.ADAPTIVEHOME_VARIANTS === '1'
					? require('./variants.cjs').variant(name, index)
					: referenceConfiguration(name),
			);
			for (const config of all) {
				await seed(harness, config);
			}
			const device = emulator(harness, { bindings: all.flatMap(c => c.bindings) }),
				log = fs.createWriteStream(path.join(root, '.local/evidence/AP-24/admin-browser.log'));
			const child = spawn(process.execPath, [path.join(adminDir, pkg.main), '0', '--console'], {
				cwd: adminDir,
				windowsHide: true,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
			child.stdout.pipe(log);
			child.stderr.pipe(log);
			let browser, page;
			try {
				await harness.startAdapterAndWait(true);
				await until(
					async () => {
						try {
							return (await fetch('http://127.0.0.1:18081/')).ok;
						} catch {
							return false;
						}
					},
					'Admin HTTP server',
					30000,
				);
				browser = await chromium.launch(
					process.env.ADAPTIVEHOME_BROWSER_CHANNEL
						? { channel: process.env.ADAPTIVEHOME_BROWSER_CHANNEL, headless: true }
						: { channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true },
				);
				page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
				const errors = [];
				page.on('console', msg => log.write(`BROWSER ${msg.type()}: ${msg.text()}\n`));
				page.on('response', response => {
					if (response.status() >= 400) {
						log.write(`HTTP ${response.status()} ${response.url()}\n`);
					}
				});
				page.on('pageerror', error => errors.push(error.message));
				await page.goto('http://127.0.0.1:18081/adapter/adaptivehome/tab_m.html');
				await page.locator('#language').selectOption('en');
				await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor({ timeout: 20000 });
				for (let index = 0; index < all.length; index++) {
					const config = all[index],
						german = index === 1;
					await page.locator('#language').selectOption(german ? 'de' : 'en');
					await page
						.getByRole('button', { name: german ? 'Import & Kanäle' : 'Import & channels', exact: true })
						.click();
					await page.locator('input[type=file]').setInputFiles({
						name: `${['apartment', 'aquarium', 'air'][index]}.json`,
						mimeType: 'application/json',
						buffer: Buffer.from(JSON.stringify(config)),
					});
					await page.getByText(german ? 'Entwurf ist gültig' : 'Draft is valid', { exact: true }).waitFor();
					await page.getByRole('button', { name: german ? 'Funktionen' : 'Functions', exact: true }).click();
					const name = page.getByRole('textbox', { name: 'Name', exact: true }).first();
					await name.fill(`${config.functions[0].name} UI`);
					await name.press('Tab');
					await page
						.getByRole('button', { name: german ? 'Entwurf prüfen' : 'Validate draft', exact: true })
						.click();
					await page.getByText(german ? 'Entwurf ist gültig' : 'Draft is valid', { exact: true }).waitFor();
					await page
						.getByRole('button', {
							name: german ? 'Änderungen aktivieren' : 'Activate changes',
							exact: true,
						})
						.click();
					await page
						.getByText(german ? 'Konfiguration aktiviert' : 'Configuration activated', { exact: true })
						.waitFor({ timeout: 15000 });
					await page.getByRole('button', { name: german ? 'Übersicht' : 'Overview', exact: true }).click();
					await page.getByRole('heading', { name: `${config.functions[0].name} UI`, exact: true }).waitFor();
					if (index === 0) {
						const motionId = config.bindings
							.find(b => b.id === 'motion')
							.capabilities.find(m => m.capability === 'motion').readId;
						const lightId = config.bindings.find(b => b.id === 'light').capabilities[0].writeId;
						await harness.states.setStateAsync(motionId, {
							val: true,
							ack: true,
							ts: Date.now(),
							from: 'system.adapter.synthetic.0',
						});
						await until(
							() => device.writes.some(w => w.id === lightId && w.value === true),
							'Admin configured motion',
						);
					}
					if (index === 1) {
						await until(
							() =>
								device.writes.some(
									w =>
										w.id ===
											config.bindings.find(b => b.id === 'circulation').capabilities[0].writeId &&
										w.value === true,
								),
							'Admin configured continuous circulation',
						);
					}
					if (index === 2) {
						await until(
							() =>
								device.writes.some(
									w =>
										w.id ===
											config.bindings.find(b => b.id === 'purifier').capabilities[0].writeId &&
										w.value === 75,
								),
							'Admin configured air control',
						);
					}
					if (process.env.ADAPTIVEHOME_VARIANTS === '1') {
						const extraId = config.bindings.find(b => b.id === 'additional').capabilities[0].writeId;
						await until(
							() => device.writes.some(w => w.id === extraId),
							'additional independently configured output',
						);
					}
					for (const language of ['de', 'en']) {
						await page.locator('#language').selectOption(language);
						await page
							.getByRole('button', { name: language === 'de' ? 'Funktionen' : 'Functions', exact: true })
							.click();
						await page.getByRole('textbox', { name: 'Name', exact: true }).first().focus();
						await page.keyboard.press('Tab');
						await page
							.getByRole('button', { name: language === 'de' ? 'Lernen' : 'Learning', exact: true })
							.click();
						await page
							.getByRole('heading', {
								name: language === 'de' ? 'Lernnachweise' : 'Learning evidence',
								exact: true,
							})
							.first()
							.waitFor();
						await page
							.getByRole('button', { name: language === 'de' ? 'Übersicht' : 'Overview', exact: true })
							.click();
					}
					await page.setViewportSize({ width: 390, height: 844 });
					assert.equal(
						await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
						true,
					);
					await page.screenshot({
						path: path.join(root, '.local/evidence/AP-24', `admin-${index}-${german ? 'de' : 'en'}.png`),
						fullPage: true,
					});
					await page.setViewportSize({ width: 1280, height: 900 });
				}
				assert.deepEqual(errors, []);
				fs.writeFileSync(
					path.join(root, '.local/evidence/AP-24/browser-result.json'),
					JSON.stringify(
						{
							admin: pkg.version,
							referenceCases: 3,
							languages: ['en', 'de'],
							widths: [1280, 390],
							pageErrors: errors,
							variants: process.env.ADAPTIVEHOME_VARIANTS === '1',
							configurations: all.map(c => ({
								timezone: c.timezone,
								devices: c.bindings.length,
								functions: c.functions.length,
								integrations: [...new Set(c.bindings.map(b => b.integrationId))],
							})),
							backend: 'actual js-controller 7.2.5 with synthetic devices',
						},
						null,
						2,
					),
				);
			} catch (error) {
				if (page) {
					await page.screenshot({
						path: path.join(root, '.local/evidence/AP-24/browser-failure.png'),
						fullPage: true,
					});
					fs.writeFileSync(
						path.join(root, '.local/evidence/AP-24/browser-failure.html'),
						await page.content(),
					);
				}
				throw error;
			} finally {
				if (browser) {
					await browser.close();
				}
				device.close();
				child.kill();
				await delay(500);
				log.end();
			}
		});
	});
}
module.exports = { defineBrowserTests };
