import { describe, expect, it } from 'vitest';
import {
  NETWORK_ERROR_MESSAGE,
  isBrowserNetworkError,
  userFacingErrorMessage,
} from '@/lib/user-facing-error';

describe('userFacingErrorMessage', () => {
  it('maps the browser Failed to fetch error to Spanish', () => {
    const error = new TypeError('Failed to fetch');
    expect(isBrowserNetworkError(error)).toBe(true);
    expect(userFacingErrorMessage(error, 'No se pudo guardar')).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it('maps Safari and Firefox network failures', () => {
    expect(userFacingErrorMessage(new TypeError('Load failed'), 'fallback')).toBe(
      NETWORK_ERROR_MESSAGE,
    );
    expect(
      userFacingErrorMessage(
        new TypeError('NetworkError when attempting to fetch resource.'),
        'fallback',
      ),
    ).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('keeps a Spanish API message', () => {
    expect(
      userFacingErrorMessage(new Error('El monto debe ser mayor a 0.'), 'fallback'),
    ).toBe('El monto debe ser mayor a 0.');
  });

  it('uses the fallback when the error has no message', () => {
    expect(userFacingErrorMessage('nope', 'No se pudo guardar')).toBe(
      'No se pudo guardar',
    );
  });
});
