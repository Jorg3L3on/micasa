import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';

const { findUniqueApiKey, updateApiKey, findFirstMembership, resolveOAuthGrantUserMock } =
  vi.hoisted(
  () => ({
    findUniqueApiKey: vi.fn(),
    updateApiKey: vi.fn(),
    findFirstMembership: vi.fn(),
    resolveOAuthGrantUserMock: vi.fn(),
  }),
);

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: { findFirst: findFirstMembership },
  },
}));

vi.mock('@/lib/server/mcp-oauth/grants', () => ({
  resolveOAuthGrantUser: resolveOAuthGrantUserMock,
}));

import { hashAgentToken } from '@/lib/server/agent-token';
import {
  AgentAuthError,
  assertScope,
  parseBearerToken,
  resolveAgentContext,
  resolveAgentUser,
  resolveOwnerForAgent,
} from '@/lib/server/resolve-agent-context';

const VALID_TOKEN = 'micasa_secreto-de-prueba-suficientemente-largo';
const OAUTH_TOKEN = 'micasa_oauth_acceso-de-prueba-suficientemente-largo';
const VALID_HASH = hashAgentToken(VALID_TOKEN);
const LEGACY_BCRYPT_HASH = hashSync(VALID_TOKEN, 4);

const activeApiKey = {
  id: 10,
  key_hash: VALID_HASH,
  revoked_at: null,
  expires_at: null,
  scopes: ['read', 'write'],
  user: { id: 2, active: true },
};

const expectAgentAuthError = async (
  promise: Promise<unknown>,
  status: number,
) => {
  try {
    await promise;
    expect.unreachable('debería haber lanzado AgentAuthError');
  } catch (error) {
    expect(error).toBeInstanceOf(AgentAuthError);
    expect((error as AgentAuthError).status).toBe(status);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  updateApiKey.mockResolvedValue({});
});

describe('parseBearerToken', () => {
  it('rechaza header ausente', () => {
    expect(() => parseBearerToken(null)).toThrowError(AgentAuthError);
  });

  it('rechaza esquemas que no son Bearer', () => {
    expect(() => parseBearerToken('Basic abc123')).toThrowError(
      AgentAuthError,
    );
  });

  it('rechaza tokens vacíos', () => {
    expect(() => parseBearerToken('Bearer   ')).toThrowError(AgentAuthError);
  });

  it('acepta Bearer con token micasa_ o micasa_oauth_', () => {
    expect(parseBearerToken(`Bearer ${VALID_TOKEN}`)).toBe(VALID_TOKEN);
    expect(parseBearerToken(`Bearer ${OAUTH_TOKEN}`)).toBe(OAUTH_TOKEN);
  });
});

describe('resolveAgentUser', () => {
  it('401 cuando el prefijo no existe', async () => {
    findUniqueApiKey.mockResolvedValue(null);
    await expectAgentAuthError(resolveAgentUser(VALID_TOKEN), 401);
  });

  it('401 cuando la llave está revocada', async () => {
    findUniqueApiKey.mockResolvedValue({
      ...activeApiKey,
      revoked_at: new Date(),
    });
    await expectAgentAuthError(resolveAgentUser(VALID_TOKEN), 401);
  });

  it('401 cuando el secreto no coincide con el hash', async () => {
    findUniqueApiKey.mockResolvedValue(activeApiKey);
    await expectAgentAuthError(
      resolveAgentUser('micasa_secreto-equivocado-igual-de-largo'),
      401,
    );
  });

  it('401 cuando la llave está expirada', async () => {
    findUniqueApiKey.mockResolvedValue({
      ...activeApiKey,
      expires_at: new Date(Date.now() - 1000),
    });
    await expectAgentAuthError(resolveAgentUser(VALID_TOKEN), 401);
  });

  it('acepta llaves con expiración futura', async () => {
    findUniqueApiKey.mockResolvedValue({
      ...activeApiKey,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });
    const result = await resolveAgentUser(VALID_TOKEN);
    expect(result.userId).toBe(2);
  });

  it('verifica hashes bcrypt legados y los migra a sha256', async () => {
    findUniqueApiKey.mockResolvedValue({
      ...activeApiKey,
      key_hash: LEGACY_BCRYPT_HASH,
    });
    const result = await resolveAgentUser(VALID_TOKEN);
    expect(result.userId).toBe(2);
    // The best-effort update re-hashes the legacy key to sha256.
    await vi.waitFor(() => expect(updateApiKey).toHaveBeenCalled());
    expect(updateApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key_hash: VALID_HASH }),
      }),
    );
  });

  it('no re-escribe el hash cuando ya es sha256', async () => {
    findUniqueApiKey.mockResolvedValue(activeApiKey);
    await resolveAgentUser(VALID_TOKEN);
    await vi.waitFor(() => expect(updateApiKey).toHaveBeenCalled());
    const updateData = updateApiKey.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('key_hash');
  });

  it('403 cuando el usuario está inactivo', async () => {
    findUniqueApiKey.mockResolvedValue({
      ...activeApiKey,
      user: { id: 2, active: false },
    });
    await expectAgentAuthError(resolveAgentUser(VALID_TOKEN), 403);
  });

  it('resuelve userId y scopes con token válido', async () => {
    findUniqueApiKey.mockResolvedValue(activeApiKey);
    const result = await resolveAgentUser(VALID_TOKEN);
    expect(result.userId).toBe(2);
    expect(result.scopes).toEqual(['read', 'write']);
    expect(result.apiKeyId).toBe(10);
    expect(result.authSource).toBe('api_key');
    expect(result.rateLimitIdentity).toBe(10);
  });

  it('resuelve OAuth access tokens con micasa_oauth_', async () => {
    resolveOAuthGrantUserMock.mockResolvedValue({
      userId: 3,
      scopes: ['read'],
      oauthGrantId: 7,
      clientName: 'ChatGPT Test Client',
    });
    const result = await resolveAgentUser(OAUTH_TOKEN);
    expect(result.userId).toBe(3);
    expect(result.scopes).toEqual(['read']);
    expect(result.oauthGrantId).toBe(7);
    expect(result.authSource).toBe('oauth_grant');
    expect(result.rateLimitIdentity).toBe(-7);
    expect(findUniqueApiKey).not.toHaveBeenCalled();
  });

  it('busca por el prefijo de 15 caracteres', async () => {
    findUniqueApiKey.mockResolvedValue(activeApiKey);
    await resolveAgentUser(VALID_TOKEN);
    expect(findUniqueApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key_prefix: VALID_TOKEN.slice(0, 15) },
      }),
    );
  });
});

describe('resolveOwnerForAgent', () => {
  it('403 en casa sin membresía', async () => {
    findFirstMembership.mockResolvedValue(null);
    await expectAgentAuthError(resolveOwnerForAgent(2, 'house', 99), 403);
  });

  it('devuelve ownerFilter de casa para miembros', async () => {
    findFirstMembership.mockResolvedValue({ role: 'MEMBER' });
    const owner = await resolveOwnerForAgent(2, 'house', 3);
    expect(owner.ownerFilter).toEqual({ user_id: null, house_id: 3 });
    expect(owner.role).toBe('member');
  });

  it('403 cuando intenta actuar como otro usuario', async () => {
    await expectAgentAuthError(resolveOwnerForAgent(2, 'user', 5), 403);
  });

  it('devuelve ownerFilter personal para sí mismo', async () => {
    const owner = await resolveOwnerForAgent(2, 'user', 2);
    expect(owner.ownerFilter).toEqual({ user_id: 2, house_id: null });
    expect(owner.role).toBe('owner');
  });

  it('400 con ownerId no entero positivo', async () => {
    await expectAgentAuthError(resolveOwnerForAgent(2, 'house', 0), 400);
  });
});

describe('resolveAgentContext', () => {
  it('compone token + owner en un contexto completo', async () => {
    findUniqueApiKey.mockResolvedValue(activeApiKey);
    findFirstMembership.mockResolvedValue({ role: 'OWNER' });
    const agent = await resolveAgentContext(
      `Bearer ${VALID_TOKEN}`,
      'house',
      3,
    );
    expect(agent.userId).toBe(2);
    expect(agent.ownerType).toBe('house');
    expect(agent.ownerFilter).toEqual({ user_id: null, house_id: 3 });
    expect(agent.scopes).toContain('write');
  });
});

describe('assertScope', () => {
  it('permite el scope presente', () => {
    expect(() => assertScope({ scopes: ['read'] }, 'read')).not.toThrow();
  });

  it('403 cuando falta el scope write', async () => {
    try {
      assertScope({ scopes: ['read'] }, 'write');
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentAuthError);
      expect((error as AgentAuthError).status).toBe(403);
    }
  });
});
