import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { buildSelectableContextsForUser } from '@/lib/server/agent-allowed-contexts';
import ConnectionsPanel, {
  type ApiKeySummary,
  type OAuthGrantSummary,
} from '@/components/settings/ConnectionsPanel';

export const metadata: Metadata = {
  title: 'Conexiones | MiCasa',
  description:
    'Administra las llaves de acceso para agentes y clientes MCP (Grok, Claude, Cursor, ChatGPT).',
};

export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = Number(session.user.id);

  const [keys, oauthGrants, selectableContexts] = await Promise.all([
    prisma.apiKey.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        name: true,
        key_prefix: true,
        scopes: true,
        last_used_at: true,
        expires_at: true,
        revoked_at: true,
        created_at: true,
        allowedContexts: { select: { owner_type: true, owner_id: true } },
      },
      orderBy: [{ revoked_at: 'asc' }, { created_at: 'desc' }],
    }),
    prisma.mcpOAuthGrant.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        client_id: true,
        scopes: true,
        last_used_at: true,
        expires_at: true,
        revoked_at: true,
        created_at: true,
        client: { select: { client_name: true } },
        allowedContexts: { select: { owner_type: true, owner_id: true } },
      },
      orderBy: [{ revoked_at: 'asc' }, { created_at: 'desc' }],
    }),
    buildSelectableContextsForUser(userId),
  ]);

  const mapContexts = (
    rows: Array<{ owner_type: 'USER' | 'HOUSE'; owner_id: number }>,
  ) =>
    rows.map((row) => ({
      ownerType: row.owner_type === 'USER' ? ('user' as const) : ('house' as const),
      ownerId: row.owner_id,
    }));

  const initialKeys: ApiKeySummary[] = keys.map((key) => ({
    id: key.id,
    name: key.name,
    key_prefix: key.key_prefix,
    scopes: key.scopes,
    allowed_contexts: mapContexts(key.allowedContexts),
    last_used_at: key.last_used_at?.toISOString() ?? null,
    expires_at: key.expires_at?.toISOString() ?? null,
    revoked_at: key.revoked_at?.toISOString() ?? null,
    created_at: key.created_at.toISOString(),
  }));

  const initialOAuthGrants: OAuthGrantSummary[] = oauthGrants.map((grant) => ({
    id: grant.id,
    client_id: grant.client_id,
    client_name: grant.client.client_name,
    scopes: grant.scopes,
    allowed_contexts: mapContexts(grant.allowedContexts),
    last_used_at: grant.last_used_at?.toISOString() ?? null,
    expires_at: grant.expires_at?.toISOString() ?? null,
    revoked_at: grant.revoked_at?.toISOString() ?? null,
    created_at: grant.created_at.toISOString(),
  }));

  return (
    <ConnectionsPanel
      initialKeys={initialKeys}
      initialOAuthGrants={initialOAuthGrants}
      selectableContexts={selectableContexts}
    />
  );
}
