// Runs every *.test.js file in this folder with Node's built-in test runner.
// Run:  node tests/run-all.js     (or: npm test)
// Extra args are passed to node --test, e.g.  node tests/run-all.js --test-reporter=spec

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => join(dir, f));

console.log(`Running ${files.length} test files:\n  ${files.map((f) => f.slice(dir.length + 1)).join('\n  ')}\n`);
const res = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(res.status ?? 1);
