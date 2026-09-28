import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_TEXT_SIZE = /text-\[(?:8|9(?:\.5)?|10|11)px\]/;

const collect = (dir: string, out: string[]) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'generated') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collect(full, out);
      continue;
    }
    if (/\.(tsx|ts|css)$/.test(entry) && !full.endsWith('caption-size.test.ts')) {
      out.push(full);
    }
  }
};

describe('caption size', () => {
  it('defines an 11px caption token for the type scale', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );
    expect(css).toContain('--text-caption-size: 0.6875rem;');
    expect(css).toContain('--text-caption: var(--text-caption-size);');
    expect(css).toContain('--text-caption--line-height: 1.35;');
  });

  it('does not render UI text below 11px', () => {
    const files: string[] = [];
    collect(resolve(process.cwd(), 'src'), files);
    const offenders = files.filter((file) =>
      FORBIDDEN_TEXT_SIZE.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
