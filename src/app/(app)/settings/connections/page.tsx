import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import ConnectionsPanel, {
  type ApiKeySummary,
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

  const keys = await prisma.apiKey.findMany({
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
    },
    orderBy: [{ revoked_at: 'asc' }, { created_at: 'desc' }],
  });

  const initialKeys: ApiKeySummary[] = keys.map((key) => ({
    id: key.id,
    name: key.name,
    key_prefix: key.key_prefix,
    scopes: key.scopes,
    last_used_at: key.last_used_at?.toISOString() ?? null,
    expires_at: key.expires_at?.toISOString() ?? null,
    revoked_at: key.revoked_at?.toISOString() ?? null,
    created_at: key.created_at.toISOString(),
  }));

  return <ConnectionsPanel initialKeys={initialKeys} />;
}
