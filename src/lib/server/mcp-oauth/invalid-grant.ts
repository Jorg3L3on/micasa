export type InvalidGrantReason =
  | 'expired'
  | 'redirect'
  | 'client'
  | 'pkce'
  | 'not_found'
  | 'resource'
  | 'other';

export class OAuthInvalidGrantError extends Error {
  readonly reason: InvalidGrantReason;

  constructor(reason: InvalidGrantReason) {
    super('invalid_grant');
    this.name = 'OAuthInvalidGrantError';
    this.reason = reason;
  }
}

export const isOAuthInvalidGrantError = (
  error: unknown,
): error is OAuthInvalidGrantError =>
  error instanceof OAuthInvalidGrantError;
