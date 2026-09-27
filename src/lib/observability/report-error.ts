import { z } from 'zod';

export type OwnerLogContext = {
  userId: number;
  ownerType: 'user' | 'house';
  ownerId: number;
};

export type ReportApiErrorOptions = {
  /** Stable route key, e.g. `POST /api/loans`. */
  route: string;
  owner?: OwnerLogContext;
  /** HTTP status that will be returned to the client. Log when ≥500 or omitted. */
  status?: number;
  errorCode?: string;
};

/** Domain / client errors that must not be logged as unexpected failures. */
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

/**
 * Log unexpected API failures as a JSON line. Skips Zod validation and known domain codes.
 * Titles use `route` (+ optional `errorCode`) — never free-form user messages.
 */
export const reportApiError = (
  error: unknown,
  options: ReportApiErrorOptions,
): void => {
  if (!shouldReportApiError(error, options)) return;

  const code = options.errorCode ?? getErrorCode(error);
  const line = JSON.stringify({
    severity: 'error',
    event: 'api.unexpected_error',
    route: options.route,
    ...(code ? { error_code: code } : {}),
    ...(options.status != null ? { http_status: options.status } : {}),
    ...(options.owner
      ? {
          user_id: options.owner.userId,
          owner_type: options.owner.ownerType,
          owner_id: options.owner.ownerId,
        }
      : {}),
    error_message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString(),
  });
  console.error(line);
};
