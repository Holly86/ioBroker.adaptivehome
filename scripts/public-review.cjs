const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const files = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {encoding: 'utf8'}).trim().split(/\r?\n/);
const blockedPath = /(^|\/)(\.local|node_modules|\.env|PRIVATE-HANDOFF\.md|STARTPROMPT\.md)(\/|$)/i;
const secrets = [/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/, /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/, /\b(?:192\.168|10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+\b/, /C:\\(?:temp|Users)\\/i];
const errors = [];
for (const file of files) {
  if (blockedPath.test(file)) errors.push(file + ': private path');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) continue;
  const value = buf.toString('utf8');
  if (secrets.some(pattern => pattern.test(value))) errors.push(file + ': sensitive content');
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Reviewed ${files.length} public files: no blocked paths or sensitive patterns. Manual diff review remains required.`);
