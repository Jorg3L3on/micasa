import { describe, expect, it } from 'vitest';

import { getPasswordHint } from '@/components/auth/password-hint';

describe('getPasswordHint', () => {
  it('states the minimum while the field is empty', () => {
    expect(getPasswordHint(0)).toEqual({ met: false, text: 'Mínimo 8 caracteres.' });
  });

  it('counts the missing characters', () => {
    expect(getPasswordHint(5)).toEqual({
      met: false,
      text: 'Te faltan 3 caracteres. Mínimo 8.',
    });
  });

  it('uses the singular for one missing character', () => {
    expect(getPasswordHint(7).text).toBe('Te falta 1 carácter. Mínimo 8.');
  });

  it('confirms at the minimum and above', () => {
    expect(getPasswordHint(8)).toEqual({ met: true, text: '8 caracteres o más' });
    expect(getPasswordHint(20).met).toBe(true);
  });
});
