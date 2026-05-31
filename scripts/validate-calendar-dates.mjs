#!/usr/bin/env node
/**
 * Fails CI when new ad-hoc calendar date patterns appear outside @/lib/calendar-dates.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const FORBIDDEN = [
  { pattern: /toISOString\(\)\.split\(['"]T['"]\)\[0\]/, label: 'toISOString().split for calendar day' },
  { pattern: /T00:00:00\.000Z/, label: 'UTC-midnight calendar write' },
];

const ALLOWLIST = new Set([
  join(SRC, 'lib/calendar-dates.ts'),
  join(SRC, 'lib/calendar-dates.test.ts'),
]);

const walk = (dir, files = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'generated') continue;
      walk(path, files);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
};

const violations = [];

for (const file of walk(SRC)) {
  if (ALLOWLIST.has(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const { pattern, label } of FORBIDDEN) {
    if (pattern.test(text)) {
      violations.push({ file: file.replace(`${ROOT}/`, ''), label });
      break;
    }
  }
}

if (violations.length > 0) {
  console.error('Calendar date anti-patterns found (use @/lib/calendar-dates):\n');
  for (const v of violations) {
    console.error(`  - ${v.file}: ${v.label}`);
  }
  process.exit(1);
}

console.log('validate-calendar-dates: OK');
