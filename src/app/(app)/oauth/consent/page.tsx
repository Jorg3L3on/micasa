import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listUserHouses } from '@/lib/house/house.service';
import { buildSelectableContextsForUser } from '@/lib/server/agent-allowed-contexts';
import { resolveOAuthClient } from '@/lib/server/mcp-oauth/clients';
import OAuthConsentForm from '@/components/oauth/OAuthConsentForm';

export const metadata: Metadata = {
  title: 'Autorizar conexión | MiCasa',
  description: 'Aprueba el acceso OAuth de un cliente MCP a tu cuenta MiCasa.',
};

type ConsentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const readParam = (
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

export default async function OAuthConsentPage({ searchParams }: ConsentPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await searchParams;
  const clientId = readParam(params, 'client_id');
  const redirectUri = readParam(params, 'redirect_uri');
  const codeChallenge = readParam(params, 'code_challenge');
  const codeChallengeMethod = readParam(params, 'code_challenge_method');

  if (!clientId || !redirectUri || !codeChallenge || codeChallengeMethod !== 'S256') {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted-foreground">
        Solicitud OAuth incompleta o inválida.
      </div>
    );
  }

  const client = await resolveOAuthClient(clientId);
  if (!client) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted-foreground">
        Cliente OAuth desconocido.
      </div>
    );
  }

  const userId = Number(session.user.id);
  const selectableContexts = await buildSelectableContextsForUser(userId);

  return (
    <OAuthConsentForm
      clientName={client.client_name}
      clientUri={client.client_uri}
      requestedScope={readParam(params, 'scope') ?? 'read write'}
      selectableContexts={selectableContexts}
      consentParams={{
        client_id: clientId,
        redirect_uri: redirectUri,
        state: readParam(params, 'state'),
        scope: readParam(params, 'scope'),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        resource: readParam(params, 'resource'),
      }}
    />
  );
}
