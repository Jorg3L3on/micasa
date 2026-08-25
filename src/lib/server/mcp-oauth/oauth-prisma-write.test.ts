import { describe, expect, it } from 'vitest';
import { OAUTH_CODE_TTL_MS } from '@/lib/server/mcp-oauth/config';
import {
  isOAuthExpiryPast,
  oauthExpiresAtFromNow,
} from '@/lib/server/mcp-oauth/oauth-expiry';
import {
  toDatabaseTimestamp,
  transformPrismaWriteArgs,
} from '@/lib/database-timestamps';

const CONSENT_INSTANT_MS = Date.parse('2026-08-26T00:56:01.000Z');
const ONE_SECOND_LATER_MS = CONSENT_INSTANT_MS + 1_000;

describe('OAuth authorization code Prisma write path', () => {
  it('would falsely expire a fresh code if expires_at went through toDatabaseTimestamp', () => {
    const expiresAt = oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS, CONSENT_INSTANT_MS);
    const shiftedWrite = toDatabaseTimestamp(expiresAt);

    expect(isOAuthExpiryPast(shiftedWrite, ONE_SECOND_LATER_MS)).toBe(true);
  });

  it('preserves UTC expires_at on McpOAuthAuthorizationCode create through transformPrismaWriteArgs', () => {
    const expiresAt = oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS, CONSENT_INSTANT_MS);
    const usedAt = new Date(CONSENT_INSTANT_MS);

    const args = transformPrismaWriteArgs(
      {
        data: {
          code_hash: 'sha256:fixture',
          client_id: 'https://chatgpt.com/oauth/fixture/client.json',
          user_id: 1,
          redirect_uri: 'https://chatgpt.com/connector/oauth/fixture',
          scopes: ['read'],
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          resource: 'https://micasa.example/api/mcp',
          expires_at: expiresAt,
          used_at: usedAt,
        },
      },
      'create',
      'McpOAuthAuthorizationCode',
    ) as {
      data: {
        expires_at: Date;
        used_at: Date;
      };
    };

    expect(args.data.expires_at).toBe(expiresAt);
    expect(args.data.used_at).toBe(usedAt);
    expect(isOAuthExpiryPast(args.data.expires_at, ONE_SECOND_LATER_MS)).toBe(false);
  });

  it('preserves UTC expiry fields on McpOAuthGrant update through transformPrismaWriteArgs', () => {
    const expiresAt = oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS, CONSENT_INSTANT_MS);
    const lastUsedAt = new Date(CONSENT_INSTANT_MS);
    const revokedAt = new Date(CONSENT_INSTANT_MS + 5_000);

    const args = transformPrismaWriteArgs(
      {
        where: { id: 1 },
        data: {
          expires_at: expiresAt,
          last_used_at: lastUsedAt,
          revoked_at: revokedAt,
        },
      },
      'update',
      'McpOAuthGrant',
    ) as {
      data: {
        expires_at: Date;
        last_used_at: Date;
        revoked_at: Date;
      };
    };

    expect(args.data.expires_at).toBe(expiresAt);
    expect(args.data.last_used_at).toBe(lastUsedAt);
    expect(args.data.revoked_at).toBe(revokedAt);
  });

  it('still wall-clock encodes ApiKey expires_at (TIMESTAMP without tz)', () => {
    const expiresAt = oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS, CONSENT_INSTANT_MS);

    const args = transformPrismaWriteArgs(
      {
        data: {
          user_id: 1,
          name: 'Fixture',
          key_hash: 'sha256:fixture',
          key_prefix: 'micasa_fixture_prefix_',
          expires_at: expiresAt,
        },
      },
      'create',
      'ApiKey',
    ) as { data: { expires_at: Date } };

    expect(args.data.expires_at).not.toBe(expiresAt);
    expect(args.data.expires_at.toISOString()).toBe(
      toDatabaseTimestamp(expiresAt).toISOString(),
    );
  });
});
