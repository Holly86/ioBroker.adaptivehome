const path = require('path');
const { tests } = require('@iobroker/testing');

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), { controllerVersion: '7.2.5', defineAdditionalTests: context => {
    before(() => require('./artifact-proof.cjs').verifyArtifact());
    require('./controller-suite.cjs').defineControllerTests(context);
    require('./sdk-controller.cjs').defineSdkTests(context);
    require('./connections-controller.cjs').defineConnectionTests(context);
    require('./hmip-host-controller.cjs').defineHmipHostTests(context);
		require('./sql-controller.cjs').defineSqlTests(context);
    require('./browser-controller.cjs').defineBrowserTests(context);
} });
