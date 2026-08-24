/** Trusted hosts for Client ID Metadata Documents (ChatGPT / OpenAI connectors). */
export const TRUSTED_CIMD_HOSTS = ['chatgpt.com', 'chat.openai.com'] as const;

export const isTrustedCimdHost = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    return (TRUSTED_CIMD_HOSTS as readonly string[]).includes(hostname);
  } catch {
    return false;
  }
};

export const isClientIdMetadataUrl = (clientId: string): boolean => {
  try {
    const url = new URL(clientId);
    return url.protocol === 'https:' && url.pathname.length > 1;
  } catch {
    return false;
  }
};

/**
 * ChatGPT may fetch one CIMD URL while the document declares another on a
 * trusted OpenAI host (e.g. chat.openai.com vs chatgpt.com).
 */
export const cimdClientIdsMatch = (
  fetchUrl: string,
  documentClientId: string,
): boolean => {
  if (fetchUrl === documentClientId) return true;
  if (!isClientIdMetadataUrl(fetchUrl) || !isClientIdMetadataUrl(documentClientId)) {
    return false;
  }
  return isTrustedCimdHost(fetchUrl) && isTrustedCimdHost(documentClientId);
};

const CHATGPT_REDIRECT_PATTERNS: RegExp[] = [
  /^https:\/\/chatgpt\.com\/connector_platform_oauth_redirect\/?$/,
  /^https:\/\/chatgpt\.com\/connector\/oauth\/[^/?#]+$/,
  /^https:\/\/chat\.openai\.com\/connector_platform_oauth_redirect\/?$/,
  /^https:\/\/chat\.openai\.com\/connector\/oauth\/[^/?#]+$/,
];

export const isAllowedChatGptRedirectUri = (redirectUri: string): boolean =>
  CHATGPT_REDIRECT_PATTERNS.some((pattern) => pattern.test(redirectUri));

export const validateRedirectUri = (
  redirectUri: string,
  allowedUris: string[],
  clientId?: string,
): boolean => {
  if (allowedUris.includes(redirectUri)) return true;
  if (clientId && isTrustedCimdHost(clientId) && isAllowedChatGptRedirectUri(redirectUri)) {
    return true;
  }
  return false;
};

/** Token endpoint auth methods that rely on PKCE (no shared client secret). */
export const isPublicTokenAuthMethod = (method: string): boolean =>
  method === 'none' || method === 'private_key_jwt';
