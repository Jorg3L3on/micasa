import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { getErrorCode, reportApiError, shouldReportApiError } from './report-error';

describe('report-error', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getErrorCode', () => {
    it('reads string code from thrown objects', () => {
      expect(getErrorCode(Object.assign(new Error('x'), { code: 'NO_MOVEMENTS' }))).toBe(
        'NO_MOVEMENTS',
      );
      expect(getErrorCode(new Error('plain'))).toBeUndefined();
    });
  });

  describe('shouldReportApiError', () => {
    it('skips Zod validation errors', () => {
      const err = new z.ZodError([]);
      expect(shouldReportApiError(err, { status: 500 })).toBe(false);
    });

    it('skips known domain error codes', () => {
      const err = Object.assign(new Error('empty'), { code: 'NO_MOVEMENTS' });
      expect(shouldReportApiError(err, {})).toBe(false);
      expect(
        shouldReportApiError(new Error('x'), { errorCode: 'CARD_NOT_FOUND' }),
      ).toBe(false);
    });

    it('skips client HTTP statuses', () => {
      expect(shouldReportApiError(new Error('auth'), { status: 401 })).toBe(false);
      expect(shouldReportApiError(new Error('bad'), { status: 400 })).toBe(false);
      expect(shouldReportApiError(new Error('conflict'), { status: 409 })).toBe(false);
    });

    it('logs 500s and status-omitted unexpected errors', () => {
      expect(shouldReportApiError(new Error('boom'), { status: 500 })).toBe(true);
      expect(shouldReportApiError(new Error('boom'), {})).toBe(true);
    });
  });

  describe('reportApiError', () => {
    it('does not log skippable errors', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      reportApiError(Object.assign(new Error('empty'), { code: 'NO_MOVEMENTS' }), {
        route: 'POST /api/credit-cards/[id]/statement-imports',
        status: 422,
      });
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('logs unexpected errors with route and owner ids', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('pdf parse failed');
      reportApiError(err, {
        route: 'POST /api/credit-cards/[id]/statement-imports',
        status: 500,
        owner: { userId: 1, ownerType: 'user', ownerId: 1 },
      });

      expect(errorSpy).toHaveBeenCalledOnce();
      const line = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
      expect(line).toMatchObject({
        severity: 'error',
        event: 'api.unexpected_error',
        route: 'POST /api/credit-cards/[id]/statement-imports',
        http_status: 500,
        user_id: 1,
        owner_type: 'user',
        owner_id: 1,
        error_message: 'pdf parse failed',
      });
    });
  });
});
