const fs = require('node:fs');
const {profileFromDefinition} = require('../build/integrations/sdk');
const profile = profileFromDefinition(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
console.log(JSON.stringify({apiVersion:profile.apiVersion,id:profile.id,backends:profile.backends,capabilities:profile.capabilities}));
