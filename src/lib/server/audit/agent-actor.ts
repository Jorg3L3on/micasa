import prisma from '@/lib/prisma';
import type { AuditActorInput } from './audit-context';
import { auditRequestId } from './route-actor';

type AgentCredential = {
  userId: number;
  apiKeyId?: number;
  oauthGrantId?: number;
};

type Names = { userName: string | null; agentLabel: string | null };

const TTL_MS = 5 * 60_000;
const cache = new Map<string, { names: Names; at: number }>();

/** User name and the key / OAuth client label, cached per credential. */
const credentialNames = async (credential: AgentCredential): Promise<Names> => {
  const key = credential.apiKeyId
    ? `k:${credential.apiKeyId}`
    : credential.oauthGrantId
      ? `g:${credential.oauthGrantId}`
      : `u:${credential.userId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.names;

  let names: Names = { userName: null, agentLabel: null };
  try {
    names = await lookupNames(credential);
  } catch {
    // Names are cosmetic on the audit row; never fail the tool call over them.
    return names;
  }
  cache.set(key, { names, at: Date.now() });
  return names;
};

const lookupNames = async (credential: AgentCredential): Promise<Names> => {
  let names: Names = { userName: null, agentLabel: null };
  if (credential.apiKeyId) {
    const row = await prisma.apiKey.findUnique({
      where: { id: credential.apiKeyId },
      select: { name: true, user: { select: { name: true } } },
    });
    names = { userName: row?.user.name ?? null, agentLabel: row?.name ?? null };
  } else if (credential.oauthGrantId) {
    const row = await prisma.mcpOAuthGrant.findUnique({
      where: { id: credential.oauthGrantId },
      select: { client: { select: { client_name: true } }, user: { select: { name: true } } },
    });
    names = { userName: row?.user.name ?? null, agentLabel: row?.client.client_name ?? null };
  } else {
    const row = await prisma.user.findUnique({ where: { id: credential.userId }, select: { name: true } });
    names = { userName: row?.name ?? null, agentLabel: null };
  }
  return names;
};

/**
 * Audit actor for an MCP tool call: the token's user, attributed to the API
 * key or OAuth grant, with the tool and the connection label in metadata.
 */
export const agentActor = async (
  toolName: string,
  credential: AgentCredential,
  request?: Request,
): Promise<AuditActorInput> => {
  const names = await credentialNames(credential);
  return {
    source: 'AGENT',
    userId: credential.userId,
    actorName: names.userName,
    apiKeyId: credential.apiKeyId ?? null,
    oauthGrantId: credential.oauthGrantId ?? null,
    requestId: auditRequestId(request),
    metadata: { tool: toolName, agent: names.agentLabel },
  };
};

/** Test hook. */
export const clearAgentActorCache = () => cache.clear();
