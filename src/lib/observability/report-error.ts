import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

export type OwnerSentryContext = {
  userId: number;
  ownerType: 'user' | 'house';
  ownerId: number;
};

export type ReportApiErrorOptions = {
  /** Stable route key for titles/fingerprints, e.g. `POST /api/loans`. */
  route: string;
  owner?: OwnerSentryContext;
  /** HTTP status that will be returned to the client. Capture when ≥500 or omitted. */
  status?: number;
  errorCode?: string;
};

/** Domain / client errors that must not become Sentry issues. */
const SKIP_ERROR_CODES = new Set([
  'NO_MOVEMENTS',
  'CARD_NOT_FOUND',
  'UNSUPPORTED_PROVIDER',
  'IMPORT_NOT_FOUND',
  'EXPENSE_TRANSFER_LOCKED',
  'EXPENSE_PAYMENT_LINKED',
  'EXPENSE_WALLET_MISMATCH',
]);

export const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
};

export const shouldReportApiError = (
  error: unknown,
  options: Pick<ReportApiErrorOptions, 'status' | 'errorCode'>,
): boolean => {
  if (error instanceof z.ZodError) return false;

  const code = options.errorCode ?? getErrorCode(error);
  if (code && SKIP_ERROR_CODES.has(code)) return false;

  if (options.status != null && options.status < 500) return false;

  return true;
};

export const setOwnerSentryContext = (owner: OwnerSentryContext) => {
  Sentry.setUser({ id: String(owner.userId) });
  Sentry.setTags({
    owner_type: owner.ownerType,
    owner_id: String(owner.ownerId),
  });
};

/**
 * Capture unexpected API failures. Skips Zod validation and known domain codes.
 * Event titles use `route` (+ optional `errorCode`) — never free-form user messages.
 */
export const reportApiError = (
  error: unknown,
  options: ReportApiErrorOptions,
): void => {
  if (options.owner) {
    setOwnerSentryContext(options.owner);
  }

  if (!shouldReportApiError(error, options)) return;

  const code = options.errorCode ?? getErrorCode(error);
  const title = code ? `${options.route} [${code}]` : options.route;

  Sentry.withScope((scope) => {
    scope.setTag('route', options.route);
    if (code) scope.setTag('error_code', code);
    if (options.status != null) scope.setTag('http_status', String(options.status));
    scope.setFingerprint([options.route, code ?? 'unexpected']);
    scope.setExtra('error_message', error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      Sentry.captureException(error, { tags: { route: options.route } });
      return;
    }

    Sentry.captureMessage(title, {
      level: 'error',
      extra: { error },
    });
  });
};
