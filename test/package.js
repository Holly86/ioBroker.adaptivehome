const path = require('path');
const { tests } = require('@iobroker/testing');
require('./setup.test.cjs');

// Validate the package files
tests.packageFiles(path.join(__dirname, '..'));
