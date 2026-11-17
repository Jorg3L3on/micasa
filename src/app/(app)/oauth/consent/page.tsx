import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { buildSelectableContextsForUser } from '@/lib/server/agent-allowed-contexts';
import OAuthConsentForm from '@/components/oauth/OAuthConsentForm';
import { buildOAuthClientDisplay } from '@/lib/oauth-client-display';
import {
  buildAuthorizePath,
  buildOAuthLoginPath,
  inlineErrorFromConsentCode,
  messageForConsentErrorCode,
} from '@/lib/oauth-consent';
import { resolveConsentDocument } from '@/lib/server/mcp-oauth/consent-document-csp';

export const metadata: Metadata = {
  title: 'Autorizar conexión',
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

const ConsentMessage = ({ children }: { children: string }) => (
  <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-muted-foreground">
    {children}
  </div>
);

export default async function OAuthConsentPage({ searchParams }: ConsentPageProps) {
  const params = await searchParams;
  const clientId = readParam(params, 'client_id');
  const redirectUri = readParam(params, 'redirect_uri');
  const codeChallenge = readParam(params, 'code_challenge');
  const codeChallengeMethod = readParam(params, 'code_challenge_method');
  const consentError = readParam(params, 'consent_error');

  const authorizePath = buildAuthorizePath({
    client_id: clientId,
    redirect_uri: redirectUri,
    state: readParam(params, 'state'),
    scope: readParam(params, 'scope'),
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    resource: readParam(params, 'resource'),
  });
  const loginPath = authorizePath ? buildOAuthLoginPath(authorizePath) : '/login';

  const session = await auth();
  if (!session?.user?.id) redirect(loginPath);

  const initialError = inlineErrorFromConsentCode(consentError, loginPath);

  if (!clientId || !redirectUri || !codeChallenge || codeChallengeMethod !== 'S256') {
    return (
      <ConsentMessage>
        {initialError?.message ?? 'Solicitud OAuth incompleta o inválida.'}
      </ConsentMessage>
    );
  }

  const document = await resolveConsentDocument(clientId, redirectUri);
  if (!document.ok) {
    return (
      <>
        {document.csp ? (
          <meta httpEquiv="Content-Security-Policy" content={document.csp} />
        ) : null}
        <ConsentMessage>{messageForConsentErrorCode(document.reason)}</ConsentMessage>
      </>
    );
  }

  const userId = Number(session.user.id);
  const selectableContexts = await buildSelectableContextsForUser(userId);
  const display = buildOAuthClientDisplay({
    clientId: document.client.client_id,
    clientUri: document.client.client_uri,
    redirectUri,
  });

  return (
    <>
      <meta httpEquiv="Content-Security-Policy" content={document.csp} />
      <OAuthConsentForm
        clientName={document.client.client_name}
        clientOrigin={display.originLabel}
        clientUri={display.safeClientUri}
        requestedScope={readParam(params, 'scope') ?? 'read write'}
        selectableContexts={selectableContexts}
        initialError={initialError}
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
    </>
  );
}
