const fs = require('node:fs'),
	path = require('node:path'),
	os = require('node:os'),
	assert = require('node:assert/strict'),
	{ spawn } = require('node:child_process');
const { emptyConfiguration, validateConfiguration } = require('../build/config/configuration');
const { contextProfiles } = require('../build/integrations/context-profiles');
const { seed, preconfigure, operator, until, delay } = require('./controller-suite.cjs');
function defineSqlTests({ suite }) {
	if (process.env.ADAPTIVEHOME_SQL !== '1') {
		return;
	}
	suite('SQL generated-data integration with a real SQLite database', getHarness => {
		it('stores a selected source through the real SQL adapter and reads its persisted JSON from SQLite', async function () {
			this.timeout(45000);
			const harness = getHarness(),
				root = path.resolve(__dirname, '..'),
				sqlDir =
					process.env.ADAPTIVEHOME_SQL_DIR ||
					path.join(root, '.local/sql-test-runtime/node_modules/iobroker.sql'),
				controller = path.join(os.tmpdir(), 'test-iobroker.adaptivehome/node_modules/iobroker.js-controller'),
				link = path.join(path.dirname(sqlDir), 'iobroker.js-controller');
			if (!fs.existsSync(link)) {
				fs.symlinkSync(controller, link, process.platform === 'win32' ? 'junction' : 'dir');
			}
			const sqlLink = path.join(path.dirname(controller), 'iobroker.sql');
			if (!fs.existsSync(sqlLink)) {
				fs.symlinkSync(sqlDir, sqlLink, process.platform === 'win32' ? 'junction' : 'dir');
			}
			const pkg = require(path.join(sqlDir, 'package.json')),
				io = require(path.join(sqlDir, 'io-package.json')),
				dbFile = path.join(root, '.local/evidence/AP-26/beta5-20261109', `logging-${Date.now()}.sqlite`);
			fs.mkdirSync(path.dirname(dbFile), { recursive: true });

			await harness.objects.setObjectAsync('system.adapter.sql.8', {
				type: 'instance',
				common: { ...io.common, name: 'sql', enabled: true, host: os.hostname(), loglevel: 'warn' },
				native: { ...io.native, dbtype: 'sqlite', fileName: dbFile, writeNulls: false, enableLogging: false },
			});
			const cfg = emptyConfiguration(),
				b = contextProfiles()
					.find(p => p.id === 'mihome-vacuum')
					.discover({
						'mihome-vacuum.42.info.battery': { type: 'number', unit: '%', read: true, write: false },
					})[0];
			cfg.bindings = [b];
			cfg.sources = [
				{ id: 'vacuumBattery', kind: 'generic', ref: { entityId: b.id, capability: 'batteryLevel' } },
			];
			cfg.logging = { enabled: true, adapter: 'sql.8', flushIntervalMs: 1000 };
			const checked = validateConfiguration(cfg);
			await seed(harness, checked, { 'mihome-vacuum.42.info.battery': 42 });
			await preconfigure(harness, checked);
			// A retained connection flag from a previous controller session is not startup evidence.
			await harness.states.setStateAsync('sql.8.info.connection', {
				val: true,
				ack: true,
				from: 'system.adapter.sql.8',
				ts: Date.now() - 60000,
			});
			const log = fs.createWriteStream(
					path.join(root, '.local/evidence/AP-26/beta5-20261109/sql-controller.log'),
				),
				sqlStartedAt = Date.now(),
				child = spawn(process.execPath, [path.join(sqlDir, pkg.main), '--instance', '8', '--console'], {
					cwd: sqlDir,
					windowsHide: true,
					stdio: ['ignore', 'pipe', 'pipe'],
				});
			child.stdout.pipe(log);
			child.stderr.pipe(log);
			const sqlite = require(require.resolve('sqlite3', { paths: [sqlDir] }));
			async function rows() {
				return new Promise((resolve, reject) => {
					const db = new sqlite.Database(dbFile, sqlite.OPEN_READONLY, error => {
						if (error) {
							return reject(error);
						}
						db.all(
							"SELECT d.name,t.val FROM ts_string t JOIN datapoints d ON d.id=t.id WHERE d.name LIKE 'adaptivehome.0.telemetry.%'",
							(error, rows) => {
								db.close();
								error ? reject(error) : resolve(rows);
							},
						);
					});
				});
			}
			try {
				await until(
					async () => {
						const connection = await harness.states.getStateAsync('sql.8.info.connection');
						return (
							connection?.val === true &&
							connection.ack === true &&
							connection.from === 'system.adapter.sql.8' &&
							connection.ts >= sqlStartedAt
						);
					},
					'isolated SQL connection',
					15000,
				);
				await harness.startAdapterAndWait(true);
				const rpc = await operator(harness);
				await until(
					async () => {
						try {
							return (await rows()).some(r => JSON.parse(r.val).record.value === 42);
						} catch {
							return false;
						}
					},
					'persisted adapter observation in SQLite',
					20000,
				);
				const stored = await rows(),
					row = stored.map(r => JSON.parse(r.val)).find(r => r.record.value === 42);
				assert.equal(row.kind, 'observation');
				assert.equal(row.record.quality, 'valid');
				assert.equal((await rpc('status')).result.sources.vacuumBattery.value, 42);
				assert.equal((await rpc('status')).result.commands.length, 0);
				fs.writeFileSync(
					path.join(root, '.local/evidence/AP-26/beta5-20261109/sql-proof.json'),
					JSON.stringify({
						adapter: pkg.version,
						database: 'SQLite',
						persistedRows: stored.length,
						generatedObservationValue: row.record.value,
						deviceCommands: 0,
						actualDatabaseRead: true,
					}),
				);
			} catch (error) {
				fs.writeFileSync(
					path.join(root, '.local/evidence/AP-26/beta5-20261109/sql-debug.json'),
					JSON.stringify({
						status: await (await operator(harness))('status'),
						journal: await harness.states.getStateAsync('adaptivehome.0.journal.sqlLogging'),
						connection: await harness.states.getStateAsync('sql.8.info.connection'),
					}),
				);
				throw error;
			} finally {
				child.kill();
				await delay(1000);
				log.end();
			}
		});
	});
}
module.exports = { defineSqlTests };
