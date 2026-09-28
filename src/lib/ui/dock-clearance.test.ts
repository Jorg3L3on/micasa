import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DOCK_CLEARANCE_PADDING_CLASS,
  DOCK_CLEARANCE_PADDING_MOBILE_CLASS,
  DOCK_FLOAT_PADDING_CLASS,
} from '@/lib/ui/dock-clearance';

describe('dock clearance', () => {
  it('points every consumer at the single CSS length', () => {
    expect(DOCK_CLEARANCE_PADDING_CLASS).toBe('pb-(--dock-clearance)');
    expect(DOCK_CLEARANCE_PADDING_MOBILE_CLASS).toContain('--dock-clearance');
    expect(DOCK_FLOAT_PADDING_CLASS).toContain('--dock-float-gap');
  });

  it('defines the length once as dock height plus the safe-area inset', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );
    expect(css).toContain('--dock-bar-height: 4rem;');
    expect(css).toContain(
      'max(env(safe-area-inset-bottom, 0px), var(--dock-float-gap))',
    );
    expect(css).not.toMatch(/pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/);
  });
});
