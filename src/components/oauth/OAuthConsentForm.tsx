'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleField } from '@/components/ui/toggle';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

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
};

export default function OAuthConsentForm({
  clientName,
  clientUri,
  requestedScope,
  consentParams,
}: OAuthConsentFormProps) {
  const [allowWrite, setAllowWrite] = useState(requestedScope.includes('write'));
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      const response = await clientFetchFromApi<{ redirect_to: string }>(
        '/api/oauth/consent',
        {
          method: 'POST',
          body: JSON.stringify({
            ...consentParams,
            allow_write: allowWrite ? 'true' : 'false',
          }),
        },
      );
      window.location.href = response.redirect_to;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo autorizar la conexión',
      );
      setSubmitting(false);
    }
  };

  const handleDeny = () => {
    const redirect = new URL(consentParams.redirect_uri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('error_description', 'El usuario rechazó la autorización');
    if (consentParams.state) redirect.searchParams.set('state', consentParams.state);
    window.location.href = redirect.toString();
  };

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
            El cliente podrá consultar tus finanzas con el token OAuth. Elige si
            también puede registrar cambios.
          </p>
          <ToggleField
            label="Permitir escritura"
            helper="Con escritura el cliente puede registrar compras, pagos y ajustes."
            checked={allowWrite}
            onCheckedChange={setAllowWrite}
            disabled={submitting}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              onClick={handleDeny}
              disabled={submitting}
            >
              Rechazar
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 rounded-xl"
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? 'Autorizando…' : 'Autorizar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
