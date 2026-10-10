import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppHeaderToolbarSkeleton } from './app-header-toolbar-skeleton';
import { TOOLBAR_GLASS_GROUP } from './toolbar-glass';

describe('AppHeaderToolbarSkeleton', () => {
  const html = renderToStaticMarkup(createElement(AppHeaderToolbarSkeleton));
  const toolbar = readFileSync(
    resolve(process.cwd(), 'src/components/app-header-toolbar.tsx'),
    'utf8',
  );

  it('uses the real toolbar wrapper, padding and glass action group', () => {
    for (const cls of [
      'relative h-full w-full min-w-0 overflow-hidden',
      'absolute inset-0 flex items-center gap-2 px-3 sm:px-5',
    ]) {
      expect(toolbar).toContain(cls);
      expect(html).toContain(cls);
    }
    expect(html).toContain(TOOLBAR_GLASS_GROUP);
  });

  it('reserves the 350px desktop search pill and the mobile search circle', () => {
    expect(html).toContain('w-[350px]');
    expect(html).toContain('size-10');
  });

  it('draws no header chrome of its own (the header owns height and border)', () => {
    expect(html).not.toMatch(/\bborder-b\b(?!lack)/);
    expect(html).not.toContain('h-16');
  });
});
