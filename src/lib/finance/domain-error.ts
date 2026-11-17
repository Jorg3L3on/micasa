/**
 * Business-rule error thrown by finance services ("Préstamo no encontrado",
 * "Saldo insuficiente…"). `code` keeps the specific reason REST routes already
 * switch on (`P2025`, `WALLET_NOT_FOUND`, `EXPENSE_WALLET_REQUIRED`…); `status`
 * is the HTTP-style class used by callers that map it generically (the MCP
 * tools turn it into NOT_FOUND / FORBIDDEN / VALIDATION).
 *
 * Internal invariants (a seed that did not run, a missing argument) stay plain
 * `Error`: they are bugs, not answers for the user.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status ?? defaultStatusForCode(code);
  }
}

const isNotFoundCode = (code: string): boolean =>
  code === 'P2025' || code === 'NOT_FOUND' || code.endsWith('_NOT_FOUND');

const defaultStatusForCode = (code: string): number => (isNotFoundCode(code) ? 404 : 400);
