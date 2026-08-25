import { describe, expect, it } from 'vitest';
import { OAUTH_CODE_TTL_MS } from '@/lib/server/mcp-oauth/config';
import {
  isLegacyOAuthExpiryPast,
  isOAuthExpiryPast,
  mexicoWallClockToUtcInstant,
  oauthExpiresAtFromNow,
  simulateLegacyTimestampRead,
} from '@/lib/server/mcp-oauth/oauth-expiry';

describe('oauth-expiry timezone handling', () => {
  it('treats legacy Mexico wall-clock TIMESTAMP reads as falsely expired vs UTC now', () => {
    const consentInstantMs = Date.parse('2026-08-26T00:56:01.000Z');
    const trueExpiry = oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS, consentInstantMs);
    const legacyRead = simulateLegacyTimestampRead(trueExpiry);

    expect(isOAuthExpiryPast(legacyRead, consentInstantMs)).toBe(true);
    expect(isLegacyOAuthExpiryPast(legacyRead, consentInstantMs)).toBe(false);
  });

  it('migration reinterpretation restores the intended UTC expiry instant', () => {
    const consentInstantMs = Date.parse('2026-08-26T00:56:01.000Z');
    const trueExpiry = oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS, consentInstantMs);
    const legacyRead = simulateLegacyTimestampRead(trueExpiry);
    const migrated = mexicoWallClockToUtcInstant(legacyRead);

    expect(migrated.getTime()).toBe(trueExpiry.getTime());
    expect(isOAuthExpiryPast(migrated, consentInstantMs)).toBe(false);
  });

  it('timestamptz values compare directly against UTC now', () => {
    const nowMs = Date.parse('2026-08-26T00:56:01.000Z');
    const future = oauthExpiresAtFromNow(OAUTH_CODE_TTL_MS, nowMs);
    expect(isOAuthExpiryPast(future, nowMs)).toBe(false);
    expect(isOAuthExpiryPast(future, nowMs + OAUTH_CODE_TTL_MS + 1)).toBe(true);
  });
});
