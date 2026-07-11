#!/usr/bin/env node
/**
 * Fails CI when code imports the removed duplicate Prisma client (db.ts).
 * Use `import prisma from '@/lib/prisma'` everywhere.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const FORBIDDEN = [
  { pattern: /from ['"]@\/lib\/db['"]/, label: '@/lib/db import' },
  { pattern: /from ['"]\.\/db['"]/, label: './db import' },
  { pattern: /import\(['"]\.\/db['"]\)/, label: "dynamic import('./db')" },
  { pattern: /from ['"]@\/lib\/db\.ts['"]/, label: '@/lib/db.ts import' },
];

const walk = (dir, files = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'generated') continue;
      walk(path, files);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
};

const violations = [];

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const { pattern, label } of FORBIDDEN) {
    if (pattern.test(text)) {
      violations.push({ file: file.replace(`${ROOT}/`, ''), label });
      break;
    }
  }
}

if (violations.length > 0) {
  console.error('Duplicate Prisma client imports found (use @/lib/prisma only):\n');
  for (const v of violations) {
    console.error(`  - ${v.file}: ${v.label}`);
  }
  process.exit(1);
}

console.log('validate-prisma-imports: OK');
