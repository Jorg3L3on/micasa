#!/usr/bin/env node
/**
 * Fails if metric strips that use METRIC_STRIP_CLASS reintroduce tinted panel
 * backgrounds. Accent should be border-l-* only (+ icon pills); see
 * fintech-ui-design-system.mdc and src/components/ui/metric-strip.ts.
 *
 * Run: npm run validate:metric-strips
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

/** Tinted fills that should not appear on metric strips / teaser shells. */
const FORBIDDEN = [
  /bg-blue-500\/5\b/,
  /dark:bg-blue-500\/8\b/,
  /bg-violet-500\/5\b/,
  /bg-violet-500\/8\b/,
  /dark:bg-violet-500\/8\b/,
  /bg-emerald-500\/5\b/,
  /dark:bg-emerald-500\/8\b/,
  /bg-green-500\/5\b/,
  /dark:bg-green-500\/8\b/,
  /bg-amber-500\/5\b/,
  /dark:bg-amber-500\/8\b/,
  /dark:bg-amber-500\/10\b/,
  /bg-destructive\/5\b/,
];

const walkTsx = (dir) => {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...walkTsx(p));
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
};

const main = () => {
  let failed = false;
  const files = walkTsx(SRC).filter((file) => {
    const text = readFileSync(file, 'utf8');
    return text.includes('METRIC_STRIP_CLASS');
  });

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      for (const re of FORBIDDEN) {
        if (re.test(line)) {
          console.error(
            `${file.replace(ROOT + '/', '')}:${i + 1}: disallowed tinted metric background (${re.source})`,
          );
          failed = true;
        }
      }
    });
  }

  if (failed) {
    console.error(
      '\nUse METRIC_STRIP_CLASS for calm metric shells; keep icon pills with bg-*/10 only.',
    );
    process.exit(1);
  }

  console.log(
    `validate-metric-strips: OK (${files.length} file(s) using METRIC_STRIP_CLASS)`,
  );
};

main();
