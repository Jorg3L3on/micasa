'use client';

import { useRef, useState } from 'react';
import { MicasaMark } from '@/components/brand/micasa-mark';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleField } from '@/components/ui/toggle';
import { ErrorBanner } from '@/components/error-banner';
import AgentContextPicker, {
  AgentContextHiddenFields,
  useDefaultContextSelection,
} from '@/components/settings/AgentContextPicker';
import type { SelectableContext } from '@/types/agent-context';
import {
  buildAuthorizePath,
  buildOAuthClientErrorUrl,
  buildOAuthLoginPath,
  interpretConsentResponse,
  OAUTH_CONSENT_COPY,
  type OAuthConsentInlineError,
} from '@/lib/oauth-consent';

type ConsentParams = {
  client_id: string;
  redirect_uri: string;
  state?: string;
  scope?: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  resource?: string;
};

type OAuthConsentFormProps = {
  clientName: string;
  /** Host of the CIMD client_id, or "Registro dinámico · <redirect host>". */
  clientOrigin: string;
  /** https client_uri only; null hides the link. */
  clientUri: string | null;
  requestedScope: string;
  consentParams: ConsentParams;
  selectableContexts: SelectableContext[];
  /** Server-rendered error (no-JS return to this page). */
  initialError?: OAuthConsentInlineError | null;
};

export default function OAuthConsentForm({
  clientName,
  clientOrigin,
  clientUri,
  requestedScope,
  consentParams,
  selectableContexts,
  initialError = null,
}: OAuthConsentFormProps) {
  const [allowWrite, setAllowWrite] = useState(requestedScope.includes('write'));
  const [selectedContexts, setSelectedContexts] = useDefaultContextSelection(
    selectableContexts,
  );
  const [error, setError] = useState<OAuthConsentInlineError | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const canAuthorize = selectedContexts.length > 0;

  const fallbackLoginUrl = (() => {
    const authorizePath = buildAuthorizePath(consentParams);
    return authorizePath ? buildOAuthLoginPath(authorizePath) : '/login';
  })();

  const handleDeny = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    window.location.assign(
      buildOAuthClientErrorUrl(
        consentParams.redirect_uri,
        'access_denied',
        consentParams.state,
        OAUTH_CONSENT_COPY.accessDenied,
      ),
    );
  };

  const handleRetry = () => {
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const decision =
      submitter instanceof HTMLButtonElement ? submitter.value : 'authorize';
    if (decision === 'deny') {
      if (submittingRef.current) return;
      window.location.assign(
        buildOAuthClientErrorUrl(
          consentParams.redirect_uri,
          'access_denied',
          consentParams.state,
          OAUTH_CONSENT_COPY.accessDenied,
        ),
      );
      return;
    }

    if (!canAuthorize || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      client_id: consentParams.client_id,
      redirect_uri: consentParams.redirect_uri,
      code_challenge: consentParams.code_challenge,
      code_challenge_method: consentParams.code_challenge_method,
      allow_write: allowWrite ? 'true' : 'false',
      context_owner_type: selectedContexts.map((entry) => entry.ownerType),
      context_owner_id: selectedContexts.map((entry) => String(entry.ownerId)),
    };
    if (consentParams.state) body.state = consentParams.state;
    if (consentParams.scope) body.scope = consentParams.scope;
    if (consentParams.resource) body.resource = consentParams.resource;

    try {
      const response = await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      const result = interpretConsentResponse(
        response.status,
        payload,
        fallbackLoginUrl,
      );
      if (result.type === 'redirect') {
        window.location.assign(result.url);
        return;
      }
      setError(result.error);
      submittingRef.current = false;
      setIsSubmitting(false);
    } catch {
      setError({ message: OAUTH_CONSENT_COPY.generic });
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <Card>
        <CardHeader className="space-y-3">
          <MicasaMark className="size-10" title="MiCasa" />
          <div className="space-y-1">
            <CardTitle className="text-base">Autorizar conexión MCP</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{clientName}</span>{' '}
              solicita acceso a tu cuenta MiCasa.
            </CardDescription>
            <p className="text-xs text-muted-foreground" data-testid="oauth-client-origin">
              Origen: <span className="font-medium text-foreground">{clientOrigin}</span>
              {clientUri ? (
                <>
                  {' · '}
                  <a
                    href={clientUri}
                    className="underline"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {clientUri}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Elige qué contextos puede ver este cliente y si también puede
            registrar cambios.
          </p>
          <form
            method="POST"
            action="/api/oauth/consent"
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            aria-busy={isSubmitting}
          >
            <input type="hidden" name="client_id" value={consentParams.client_id} />
            <input type="hidden" name="redirect_uri" value={consentParams.redirect_uri} />
            <input type="hidden" name="code_challenge" value={consentParams.code_challenge} />
            <input
              type="hidden"
              name="code_challenge_method"
              value={consentParams.code_challenge_method}
            />
            {consentParams.state ? (
              <input type="hidden" name="state" value={consentParams.state} />
            ) : null}
            {consentParams.scope ? (
              <input type="hidden" name="scope" value={consentParams.scope} />
            ) : null}
            {consentParams.resource ? (
              <input type="hidden" name="resource" value={consentParams.resource} />
            ) : null}
            <input type="hidden" name="allow_write" value={allowWrite ? 'true' : 'false'} />
            <AgentContextHiddenFields value={selectedContexts} />
            <AgentContextPicker
              idPrefix="oauth-consent"
              contexts={selectableContexts}
              value={selectedContexts}
              onChange={setSelectedContexts}
              disabled={isSubmitting}
            />
            <ToggleField
              label="Permitir escritura"
              helper="Con escritura el cliente puede registrar compras, pagos y ajustes."
              checked={allowWrite}
              onCheckedChange={setAllowWrite}
              disabled={isSubmitting}
            />
            {error ? (
              <div className="flex flex-col gap-2" data-testid="oauth-consent-error">
                <ErrorBanner>
                  {error.loginUrl ? (
                    <a href={error.loginUrl} className="font-medium underline">
                      {OAUTH_CONSENT_COPY.signInAgain}
                    </a>
                  ) : (
                    error.message
                  )}
                </ErrorBanner>
                {error.loginUrl ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={handleRetry}
                  >
                    {OAUTH_CONSENT_COPY.retry}
                  </Button>
                )}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                name="decision"
                value="authorize"
                className="h-11 flex-1 rounded-xl sm:order-2"
                disabled={!canAuthorize || isSubmitting}
                aria-busy={isSubmitting}
              >
                Autorizar
              </Button>
              <Button
                type="submit"
                name="decision"
                value="deny"
                variant="outline"
                className="order-first h-11 flex-1 rounded-xl"
                disabled={isSubmitting}
                onClick={handleDeny}
              >
                Rechazar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
