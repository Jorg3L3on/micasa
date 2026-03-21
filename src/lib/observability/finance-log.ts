/**
 * Structured finance logs (JSON lines). Stable `event` names for dashboards / alerts:
 *
 * | event | severity | when |
 * |-------|----------|------|
 * | credit_card.payment.created | info | Card payment persisted |
 * | credit_card.purchase.created | info | Card purchase (expense) created |
 * | finance.liquidity_projection.computed | info | GET /api/wallets/liquidity-projection (duration_ms, milestone_count) |
 * | finance.api.client_error | warn | 400 from wallet/credit rules (`error_code`: INSUFFICIENT_*, CREDIT_LIMIT_EXCEEDED). Emitted from card payment/purchase, `POST`/`PUT` /api/transactions, `PATCH` /api/expenses/[id]/paid |
 *
 * Common fields: owner_type, owner_id; optional request_id from headers.
 */

type FinanceLogValue = string | number | boolean | null | undefined;

type LogRequest = { headers: Headers };

export const getRequestIdFromRequest = (request: LogRequest) => {
  const fromClient = request.headers.get('x-request-id')?.trim();
  if (fromClient) return fromClient;
  const vercel = request.headers.get('x-vercel-id')?.trim();
  if (vercel) return vercel;
  return undefined;
};

export const logFinanceEvent = (
  severity: 'info' | 'warn',
  event: string,
  fields: Record<string, FinanceLogValue>,
  request?: LogRequest,
) => {
  const requestId = request ? getRequestIdFromRequest(request) : undefined;
  const line = JSON.stringify({
    severity,
    event,
    ...fields,
    ...(requestId ? { request_id: requestId } : {}),
    at: new Date().toISOString(),
  });
  if (severity === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
};
