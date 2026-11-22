const path = require('path');
const fs = require('node:fs');
const os = require('node:os');
const { tests } = require('@iobroker/testing');

// The controller reset must not traverse links to separately installed test fixtures.
// Remove only our known links before the harness clears its own temporary directory.
for (const [name, configured, fallback] of [
    ['admin', process.env.ADAPTIVEHOME_ADMIN_DIR, '.local/admin-runtime/node_modules/iobroker.admin'],
    ['sql', process.env.ADAPTIVEHOME_SQL_DIR, '.local/sql-test-runtime/node_modules/iobroker.sql'],
]) {
    const link = path.join(os.tmpdir(), 'test-iobroker.adaptivehome/node_modules', `iobroker.${name}`);
    try {
        if (fs.lstatSync(link).isSymbolicLink()) {
            const expected = path.resolve(configured || path.join(__dirname, '..', fallback));
            const actual = path.resolve(path.dirname(link), fs.readlinkSync(link));
            if ((process.platform === 'win32' ? actual.toLowerCase() !== expected.toLowerCase() : actual !== expected)) {
                throw new Error(`unexpected_external_test_fixture:${name}`);
            }
            fs.unlinkSync(link);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), { controllerVersion: '7.2.5', defineAdditionalTests: context => {
    before(() => require('./artifact-proof.cjs').verifyArtifact());
    require('./controller-suite.cjs').defineControllerTests(context);
    require('./sdk-controller.cjs').defineSdkTests(context);
    require('./connections-controller.cjs').defineConnectionTests(context);
    require('./hmip-host-controller.cjs').defineHmipHostTests(context);
    require('./read-regressions-controller.cjs').defineReadRegressionTests(context);
    require('./maintenance-controller.cjs').defineMaintenanceTests(context);
    require('./shutdown-controller.cjs').defineShutdownTests(context);
		require('./sql-controller.cjs').defineSqlTests(context);
    require('./browser-controller.cjs').defineBrowserTests(context);
} });
