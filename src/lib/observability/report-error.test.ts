import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const sentryMocks = vi.hoisted(() => {
  const setTags = vi.fn();
  return {
    setUser: vi.fn(),
    setTags,
    withScope: vi.fn(
      (
        cb: (scope: {
          setTag: typeof setTags;
          setFingerprint: ReturnType<typeof vi.fn>;
          setExtra: ReturnType<typeof vi.fn>;
        }) => void,
      ) => {
        cb({
          setTag: setTags,
          setFingerprint: vi.fn(),
          setExtra: vi.fn(),
        });
      },
    ),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
});

vi.mock('@sentry/nextjs', () => sentryMocks);

import {
  getErrorCode,
  reportApiError,
  setOwnerSentryContext,
  shouldReportApiError,
} from './report-error';

describe('report-error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('captures 500s and status-omitted unexpected errors', () => {
      expect(shouldReportApiError(new Error('boom'), { status: 500 })).toBe(true);
      expect(shouldReportApiError(new Error('boom'), {})).toBe(true);
    });
  });

  describe('setOwnerSentryContext', () => {
    it('sets user id and owner tags without PII', () => {
      setOwnerSentryContext({ userId: 7, ownerType: 'house', ownerId: 3 });
      expect(sentryMocks.setUser).toHaveBeenCalledWith({ id: '7' });
      expect(sentryMocks.setTags).toHaveBeenCalledWith({
        owner_type: 'house',
        owner_id: '3',
      });
    });
  });

  describe('reportApiError', () => {
    it('does not capture skippable errors', () => {
      reportApiError(Object.assign(new Error('empty'), { code: 'NO_MOVEMENTS' }), {
        route: 'POST /api/credit-cards/[id]/statement-imports',
        status: 422,
      });
      expect(sentryMocks.captureException).not.toHaveBeenCalled();
      expect(sentryMocks.captureMessage).not.toHaveBeenCalled();
    });

    it('captures unexpected errors with stable route fingerprint', () => {
      const err = new Error('pdf parse failed');
      reportApiError(err, {
        route: 'POST /api/credit-cards/[id]/statement-imports',
        status: 500,
        owner: { userId: 1, ownerType: 'user', ownerId: 1 },
      });

      expect(sentryMocks.setUser).toHaveBeenCalledWith({ id: '1' });
      expect(sentryMocks.captureException).toHaveBeenCalledWith(err, {
        tags: { route: 'POST /api/credit-cards/[id]/statement-imports' },
      });
    });
  });
});
