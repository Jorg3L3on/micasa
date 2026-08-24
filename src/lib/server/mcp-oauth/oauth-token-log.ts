type OAuthTokenFailureFields = {
  grant_type: string;
  has_code: boolean;
  has_verifier: boolean;
  has_assertion: boolean;
  client_id_host?: string;
  error: string;
};

export const clientIdHostOnly = (clientId: string): string | undefined => {
  try {
    if (clientId.includes('://')) {
      return new URL(clientId).hostname;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export const logOAuthTokenFailure = (fields: OAuthTokenFailureFields): void => {
  console.warn(
    JSON.stringify({
      severity: 'warn',
      event: 'oauth.token.failure',
      ...fields,
      at: new Date().toISOString(),
    }),
  );
};
