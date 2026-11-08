const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const [id, implementationStatus, verificationStatus, summary, ...openChecks] = process.argv.slice(2);
const file = path.join(root, 'docs/implementation/work-packages.json');
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const ap = manifest.packages.find(p => p.id === id);
if (!ap || !summary) throw new Error('Expected AP id, implementation status, verification status, summary');
Object.assign(ap, {implementationStatus, verificationStatus,
  status: verificationStatus === 'passed' ? 'verified' : implementationStatus === 'implemented' ? 'implemented' : 'in_progress',
  evidence: [`docs/verification/${id}.md`], openChecks, updatedAt: new Date().toISOString()});
fs.mkdirSync(path.join(root, 'docs/verification'), {recursive: true});
fs.writeFileSync(path.join(root, `docs/verification/${id}.md`), `# ${id} ${ap.title}\n\n${summary}\n\nImplementation: ${implementationStatus}. Verification: ${verificationStatus}.\n\n${openChecks.length ? 'Open checks:\n' + openChecks.map(s => '- ' + s).join('\n') : 'No outstanding checks for this package.'}\n`);
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
