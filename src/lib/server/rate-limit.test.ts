import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildRateLimitKey,
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  resetRateLimitStoreForTests,
  resolveRateLimitIdentity,
} from './rate-limit';

const requestWithIp = (ip: string): Request =>
  new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });

describe('rate-limit', () => {
  afterEach(() => {
    resetRateLimitStoreForTests();
    vi.unstubAllEnvs();
  });

  it('extracts the first forwarded IP', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
    });
    expect(getClientIp(request)).toBe('203.0.113.1');
  });

  it('builds IP-scoped keys', () => {
    expect(buildRateLimitKey('auth:login', 'ip:203.0.113.1')).toBe(
      'micasa:rl:auth:login:ip:203.0.113.1',
    );
  });

  it('builds user-scoped identity for mutation policies', () => {
    const request = requestWithIp('203.0.113.1');
    expect(resolveRateLimitIdentity('mutation:receipt-upload', request, 42)).toBe('user:42');
    expect(resolveRateLimitIdentity('mutation:receipt-upload', request)).toBeNull();
  });

  it('allows requests under the login limit', async () => {
    const request = requestWithIp('10.0.0.5');

    for (let i = 0; i < 5; i += 1) {
      const result = await checkRateLimit(request, 'auth:login');
      expect(result.limited).toBe(false);
    }
  });

  it('limits the 6th login attempt from the same IP', async () => {
    const request = requestWithIp('10.0.0.6');

    for (let i = 0; i < 5; i += 1) {
      await checkRateLimit(request, 'auth:login');
    }

    const blocked = await checkRateLimit(request, 'auth:login');
    expect(blocked.limited).toBe(true);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('returns 429 from enforceRateLimit when exceeded', async () => {
    const request = requestWithIp('10.0.0.7');

    for (let i = 0; i < 10; i += 1) {
      await checkRateLimit(request, 'auth:register');
    }

    const response = await enforceRateLimit(request, 'auth:register');
    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBeTruthy();
    await expect(response?.json()).resolves.toEqual({
      error: 'Demasiadas solicitudes. Inténtalo más tarde.',
    });
  });

  it('uses in-memory store when Upstash env vars are absent', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    const request = requestWithIp('10.0.0.8');
    const result = await checkRateLimit(request, 'auth:login');
    expect(result.limited).toBe(false);
  });
});
