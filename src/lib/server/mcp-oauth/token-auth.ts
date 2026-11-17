/**
 * Token endpoint client authentication is PKCE (plus client_secret_post for
 * confidential DCR clients). private_key_jwt was retired in MIC-I5: a
 * client_assertion, if sent, is ignored and never replaces the code_verifier.
 */
export const isValidPkceVerifier = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length >= 43 && value.length <= 128;
