import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn type scale', () => {
  it('keeps a custom size next to a text color', () => {
    expect(cn('text-section text-foreground')).toBe(
      'text-section text-foreground',
    );
    expect(cn('text-caption text-muted-foreground')).toBe(
      'text-caption text-muted-foreground',
    );
  });

  it('dedupes two custom sizes and keeps the later one', () => {
    expect(cn('text-section text-title')).toBe('text-title');
    expect(cn('text-display text-body text-foreground')).toBe(
      'text-body text-foreground',
    );
  });
});