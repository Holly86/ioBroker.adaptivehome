const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verifyArtifact() {
	if (!process.env.ADAPTIVEHOME_PACKAGE) {
		return;
	}
	const root = path.resolve(__dirname, '..');
	const artifact = path.resolve(process.env.ADAPTIVEHOME_PACKAGE);
	const testRoot = path.join(os.tmpdir(), 'test-iobroker.adaptivehome');
	// @iobroker/testing itself npm-packs and installs this tarball before any startup.
	// Equal bytes prove this installation is the frozen release artifact, not a source checkout.
	assert.equal(digest(path.join(testRoot, path.basename(artifact))), digest(artifact));
	const installed = path.join(testRoot, 'node_modules/iobroker.adaptivehome');
	let files = 0;
	function compare(relative) {
		for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
			if (relative.startsWith('admin') && entry.name.endsWith('.d.ts')) {
				continue;
			}
			const target = path.join(relative, entry.name);
			if (entry.isDirectory()) {
				compare(target);
			} else {
				assert.equal(digest(path.join(installed, target)), digest(path.join(root, target)), target);
				files++;
			}
		}
	}
	compare('build');
	compare('admin');
	const result = {
		sha256: digest(artifact),
		artifact: path.basename(artifact),
		comparedRuntimeFiles: files,
		installedVersion: JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8')).version,
		installation: 'npm-installed frozen tarball in isolated js-controller 7.2.5',
	};
	fs.mkdirSync(path.join(root, '.local/evidence/AP-25'), { recursive: true });
	fs.writeFileSync(path.join(root, '.local/evidence/AP-25/artifact-proof.json'), JSON.stringify(result, null, 2));
}
module.exports = { verifyArtifact };
