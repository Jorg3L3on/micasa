#!/usr/bin/env node
/**
 * Two rules from DESIGN.md:
 * 1. No colored left accent anywhere in src (Plania decision 41117366): no
 *    `border-l-[Npx]`, no colored `border-l-<color>` / `border-l-[oklch(...)]`,
 *    no inline `borderLeftColor` / `borderLeftWidth`, no inset left shadow
 *    (`inset_3px_0_0...` / `inset 3px 0 0 ...`). Neutral hairlines
 *    (`border-l`, `border-l-2 border-border/60`, `border-l-transparent`) stay allowed.
 * 2. Metric strips that use METRIC_STRIP_CLASS keep no tinted panel fill.
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

/** Colored left accents (any file under src). */
const NEUTRAL_LEFT = /^border-l-(transparent|border|white\/|black\/|input|sidebar)/;
const LEFT_ACCENT = [
  { re: /\bborder-l-\[\d+(\.\d+)?(px|rem)\]/, why: 'thick left border (border-l-[Npx])' },
  { re: /\bborder-l-(\[(?:oklch|rgb|hsl|#|color-mix|var)[^\]]*\]|[a-z]+(?:-[a-z]+)*(?:-\d{2,3})?(?:\/[\d.\[\]]+)?)/g, why: 'colored left border', colorCheck: true },
  { re: /\bborderLeft(Color|Width)?\s*:/, why: 'inline left border style' },
  { re: /inset[_ ]\d+(\.\d+)?px[_ ]0[_ ]0/, why: 'inset left shadow stripe' },
];

const isColoredLeftClass = (token) => {
  if (NEUTRAL_LEFT.test(token)) return false;
  // border-l-0 / border-l-2 / border-l-4 are widths, not colors (thick widths are caught by rule 1).
  if (/^border-l-\d+$/.test(token)) return false;
  return true;
};

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
  const all = walkTsx(SRC).filter((file) => !file.includes('/generated/'));

  for (const file of all) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const rule of LEFT_ACCENT) {
        if (rule.colorCheck) {
          for (const m of line.matchAll(rule.re)) {
            if (isColoredLeftClass(m[0])) {
              console.error(`${file.replace(ROOT + '/', '')}:${i + 1}: ${rule.why} (${m[0]})`);
              failed = true;
            }
          }
        } else if (rule.re.test(line)) {
          console.error(`${file.replace(ROOT + '/', '')}:${i + 1}: ${rule.why}`);
          failed = true;
        }
      }
    });
  }

  const files = all.filter((file) => {
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
      '\nColored left accents are never used (DESIGN.md): put status on the value color, a STATUS_BADGE chip or a soft tint.\nUse METRIC_STRIP_CLASS for calm metric shells; keep icon pills with bg-*/10 only.',
    );
    process.exit(1);
  }

  console.log(
    `validate-metric-strips: OK (no left accents in ${all.length} file(s); ${files.length} using METRIC_STRIP_CLASS)`,
  );
};

main();
