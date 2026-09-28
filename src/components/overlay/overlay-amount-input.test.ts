import { describe, expect, it } from 'vitest';

import {
  OVERLAY_AMOUNT_INPUT_CLASS,
  OVERLAY_ROW_NUMBER_INPUT_CLASS,
} from '@/components/overlay/overlay-form';

describe('overlay amount input', () => {
  it('uses sans tabular figures so 0.00 has no mono gap around the decimal', () => {
    expect(OVERLAY_AMOUNT_INPUT_CLASS).toContain('font-sans');
    expect(OVERLAY_AMOUNT_INPUT_CLASS).toContain('tabular-nums');
    expect(OVERLAY_AMOUNT_INPUT_CLASS).not.toContain('font-mono');
    expect(OVERLAY_ROW_NUMBER_INPUT_CLASS).not.toContain('font-mono');
    expect('0.00').not.toMatch(/\s/);
  });
});
