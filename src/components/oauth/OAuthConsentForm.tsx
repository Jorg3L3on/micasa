'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleField } from '@/components/ui/toggle';
import AgentContextPicker, {
  AgentContextHiddenFields,
  useDefaultContextSelection,
  type SelectableContext,
} from '@/components/settings/AgentContextPicker';

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
  clientUri: string | null;
  requestedScope: string;
  consentParams: ConsentParams;
  selectableContexts: SelectableContext[];
};

export default function OAuthConsentForm({
  clientName,
  clientUri,
  requestedScope,
  consentParams,
  selectableContexts,
}: OAuthConsentFormProps) {
  const [allowWrite, setAllowWrite] = useState(requestedScope.includes('write'));
  const [selectedContexts, setSelectedContexts] = useDefaultContextSelection(
    selectableContexts,
  );

  const handleDeny = () => {
    const redirect = new URL(consentParams.redirect_uri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('error_description', 'El usuario rechazó la autorización');
    if (consentParams.state) redirect.searchParams.set('state', consentParams.state);
    window.location.href = redirect.toString();
  };

  const canAuthorize = selectedContexts.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <Card>
        <CardHeader className="space-y-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-base">Autorizar conexión MCP</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{clientName}</span>
              {clientUri ? (
                <>
                  {' '}
                  (<a href={clientUri} className="underline" target="_blank" rel="noreferrer">
                    {clientUri}
                  </a>
                  )
                </>
              ) : null}{' '}
              solicita acceso a tu cuenta MiCasa.
            </CardDescription>
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
            />
            <ToggleField
              label="Permitir escritura"
              helper="Con escritura el cliente puede registrar compras, pagos y ajustes."
              checked={allowWrite}
              onCheckedChange={setAllowWrite}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                onClick={handleDeny}
              >
                Rechazar
              </Button>
              <Button
                type="submit"
                className="h-11 flex-1 rounded-xl"
                disabled={!canAuthorize}
              >
                Autorizar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
