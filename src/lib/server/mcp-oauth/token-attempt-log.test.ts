import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  mcpOAuthTokenAttempt: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

import { recordTokenAttempt } from '@/lib/server/mcp-oauth/token-attempt-log';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.mcpOAuthTokenAttempt.create.mockResolvedValue({ id: 1 });
});

describe('recordTokenAttempt', () => {
  it('writes one row with the outcome and no follow-up updates', async () => {
    await recordTokenAttempt({
      path: '/api/oauth/token',
      method: 'POST',
      content_type: 'application/x-www-form-urlencoded',
      body: {
        grant_type: 'authorization_code',
        has_code: true,
        has_verifier: true,
        has_assertion: false,
        client_id_kind: 'cimd_instance',
        redirect_kind: 'connector_instance',
        resource_kind: 'api_mcp',
      },
      error: 'invalid_grant',
      http_status: 400,
      invalid_grant_reason: 'code_reuse',
    });

    expect(prismaMock.mcpOAuthTokenAttempt.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.mcpOAuthTokenAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: 'POST',
        has_verifier: true,
        error: 'invalid_grant',
        http_status: 400,
        invalid_grant_reason: 'code_reuse',
      }),
    });
    expect(prismaMock.mcpOAuthTokenAttempt.update).not.toHaveBeenCalled();
  });

  it('swallows DB errors so logging never breaks the token response', async () => {
    prismaMock.mcpOAuthTokenAttempt.create.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      recordTokenAttempt({
        path: '/api/oauth/token',
        method: 'POST',
        error: 'ok',
        http_status: 200,
      }),
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
