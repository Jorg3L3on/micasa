import crypto from 'node:crypto';
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
  OAUTH_TOKEN_LOOKUP_LENGTH,
} from '@/lib/server/mcp-oauth/config';

const SHA256_HASH_PREFIX = 'sha256:';

export type GeneratedOAuthToken = {
  token: string;
  tokenPrefix: string;
  tokenHash: string;
};

const buildToken = (prefix: string): GeneratedOAuthToken => {
  const token = `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
  return {
    token,
    tokenPrefix: token.slice(0, OAUTH_TOKEN_LOOKUP_LENGTH),
    tokenHash: hashOAuthSecret(token),
  };
};

export const generateOAuthAccessToken = (): GeneratedOAuthToken =>
  buildToken(OAUTH_ACCESS_TOKEN_PREFIX);

export const generateOAuthRefreshToken = (): GeneratedOAuthToken =>
  buildToken(OAUTH_REFRESH_TOKEN_PREFIX);

export const generateAuthorizationCode = (): GeneratedOAuthToken =>
  buildToken('micasa_code_');

export const hashOAuthSecret = (secret: string): string =>
  `${SHA256_HASH_PREFIX}${crypto.createHash('sha256').update(secret).digest('hex')}`;

export const verifyOAuthSecret = (
  secret: string,
  storedHash: string,
): boolean => {
  if (!storedHash.startsWith(SHA256_HASH_PREFIX)) return false;
  const expected = Buffer.from(storedHash.slice(SHA256_HASH_PREFIX.length), 'hex');
  const actual = crypto.createHash('sha256').update(secret).digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const verifyPkceS256 = (
  codeVerifier: string,
  codeChallenge: string,
): boolean => {
  const digest = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return digest === codeChallenge;
};
