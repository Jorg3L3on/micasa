import { NextResponse } from 'next/server';

/**
 * Rate limit policies (v1). Keys:
 * - IP-scoped: `micasa:rl:{policy}:ip:{ip}`
 * - User-scoped: `micasa:rl:{policy}:user:{userId}`
 */
export type RateLimitPolicyId =
  | 'auth:login'
  | 'auth:register'
  | 'mutation:statement-import'
  | 'mutation:receipt-upload';

type RateLimitScope = 'ip' | 'user';

type RateLimitPolicy = {
  max: number;
  windowMs: number;
  scope: RateLimitScope;
};

export const RATE_LIMIT_POLICIES: Record<RateLimitPolicyId, RateLimitPolicy> = {
  'auth:login': { max: 5, windowMs: 15 * 60 * 1000, scope: 'ip' },
  'auth:register': { max: 10, windowMs: 60 * 60 * 1000, scope: 'ip' },
  'mutation:statement-import': { max: 20, windowMs: 60 * 60 * 1000, scope: 'user' },
  'mutation:receipt-upload': { max: 20, windowMs: 60 * 60 * 1000, scope: 'user' },
};

const RATE_LIMIT_ERROR = 'Demasiadas solicitudes. Inténtalo más tarde.';

type MemoryEntry = { count: number; resetAt: number };

const memoryStore = new Map<string, MemoryEntry>();

const useUpstash = (): boolean =>
  Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export const getClientIp = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
};

export const buildRateLimitKey = (
  policyId: RateLimitPolicyId,
  identity: string,
): string => `micasa:rl:${policyId}:${identity}`;

export const resolveRateLimitIdentity = (
  policyId: RateLimitPolicyId,
  request: Request,
  userId?: number,
): string | null => {
  const policy = RATE_LIMIT_POLICIES[policyId];
  if (policy.scope === 'user') {
    if (userId == null || Number.isNaN(userId)) return null;
    return `user:${userId}`;
  }
  return `ip:${getClientIp(request)}`;
};

const incrementMemory = (
  key: string,
  windowMs: number,
): { count: number; retryAfterMs: number } => {
  const now = Date.now();
  let entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    memoryStore.set(key, entry);
  }
  entry.count += 1;
  return {
    count: entry.count,
    retryAfterMs: Math.max(0, entry.resetAt - now),
  };
};

const incrementUpstash = async (
  key: string,
  windowMs: number,
): Promise<{ count: number; retryAfterMs: number }> => {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const windowSeconds = Math.ceil(windowMs / 1000);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const pipelineRes = await fetch(`${baseUrl}/pipeline`, {
    method: 'POST',
    headers,
    body: JSON.stringify([
      ['INCR', key],
      ['TTL', key],
    ]),
  });

  if (!pipelineRes.ok) {
    throw new Error(`Upstash rate limit pipeline failed: ${pipelineRes.status}`);
  }

  const pipeline = (await pipelineRes.json()) as Array<{ result: number }>;
  const count = pipeline[0]?.result ?? 1;
  let ttlSeconds = pipeline[1]?.result ?? -1;

  if (ttlSeconds < 0) {
    const expireRes = await fetch(`${baseUrl}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
      method: 'POST',
      headers,
    });
    if (!expireRes.ok) {
      throw new Error(`Upstash rate limit expire failed: ${expireRes.status}`);
    }
    ttlSeconds = windowSeconds;
  }

  return {
    count,
    retryAfterMs: Math.max(0, ttlSeconds * 1000),
  };
};

export type RateLimitCheckResult = {
  limited: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

export const checkRateLimit = async (
  request: Request,
  policyId: RateLimitPolicyId,
  userId?: number,
): Promise<RateLimitCheckResult> => {
  const policy = RATE_LIMIT_POLICIES[policyId];
  const identity = resolveRateLimitIdentity(policyId, request, userId);
  if (!identity) {
    return { limited: false, retryAfterSeconds: 0, remaining: policy.max };
  }

  const key = buildRateLimitKey(policyId, identity);
  const { count, retryAfterMs } = useUpstash()
    ? await incrementUpstash(key, policy.windowMs)
    : incrementMemory(key, policy.windowMs);

  const limited = count > policy.max;
  const retryAfterSeconds = limited ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0;
  const remaining = Math.max(0, policy.max - count);

  if (limited) {
    logRateLimitViolation(policyId, identity, request);
  }

  return { limited, retryAfterSeconds, remaining };
};

const logRateLimitViolation = (
  policyId: RateLimitPolicyId,
  identity: string,
  request: Request,
) => {
  console.warn(
    JSON.stringify({
      severity: 'warn',
      event: 'security.rate_limit.exceeded',
      policy: policyId,
      identity,
      ip: getClientIp(request),
      at: new Date().toISOString(),
    }),
  );
};

export const rateLimitResponse = (retryAfterSeconds: number): NextResponse =>
  NextResponse.json(
    { error: RATE_LIMIT_ERROR },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    },
  );

/** Returns a 429 response when limited, otherwise null (caller may proceed). */
export const enforceRateLimit = async (
  request: Request,
  policyId: RateLimitPolicyId,
  userId?: number,
): Promise<NextResponse | null> => {
  const result = await checkRateLimit(request, policyId, userId);
  if (!result.limited) return null;
  return rateLimitResponse(result.retryAfterSeconds);
};

/** @internal Test helper */
export const resetRateLimitStoreForTests = (): void => {
  memoryStore.clear();
};
