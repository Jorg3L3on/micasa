import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import {
  getMcpResourceUrl,
  normalizeMcpResourceUrl,
  parseScopeParam,
} from '@/lib/server/mcp-oauth/config';
import { createAuthorizationCode } from '@/lib/server/mcp-oauth/grants';
import {
  parseConsentFormData,
  parseContextFieldsFromForm,
  scalarConsentField,
  validateSelectableContexts,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/agent-auth-error';

const consentFieldsSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  state: z.string().optional(),
  scope: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url().optional(),
  allow_write: z.enum(['true', 'false']).optional(),
});

const parseConsentBody = async (
  request: NextRequest,
): Promise<{
  fields: Record<string, string | string[]>;
  formPost: boolean;
}> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    return { fields: parseConsentFormData(form), formPost: true };
  }
  const json = (await request.json()) as Record<string, string | string[]>;
  return { fields: json, formPost: false };
};

const buildOAuthCallbackUrl = (input: {
  redirectUri: string;
  code: string;
  state?: string;
}): URL => {
  const redirect = new URL(input.redirectUri);
  redirect.searchParams.set('code', input.code);
  if (input.state) redirect.searchParams.set('state', input.state);
  return redirect;
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
  }

  try {
    const { fields, formPost } = await parseConsentBody(request);
    const input = consentFieldsSchema.parse({
      client_id: scalarConsentField(fields, 'client_id'),
      redirect_uri: scalarConsentField(fields, 'redirect_uri'),
      state: scalarConsentField(fields, 'state'),
      scope: scalarConsentField(fields, 'scope'),
      code_challenge: scalarConsentField(fields, 'code_challenge'),
      code_challenge_method: scalarConsentField(fields, 'code_challenge_method'),
      resource: scalarConsentField(fields, 'resource'),
      allow_write: scalarConsentField(fields, 'allow_write'),
    });
    const client = await resolveOAuthClient(input.client_id);
    if (!client) {
      return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 });
    }

    assertRedirectUriAllowed(client, input.redirect_uri);

    let scopes = parseScopeParam(input.scope);
    if (input.allow_write === 'false') {
      scopes = scopes.filter((scope) => scope !== 'write');
    }
    if (!scopes.includes('read')) scopes = ['read', ...scopes];

    const resource = normalizeMcpResourceUrl(
      input.resource ?? getMcpResourceUrl(request),
      request,
    );

    const parsedContexts = parseContextFieldsFromForm(fields);
    const allowedContexts = await validateSelectableContexts(userId, parsedContexts);

    const code = await createAuthorizationCode({
      clientId: input.client_id,
      userId,
      redirectUri: input.redirect_uri,
      scopes,
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method,
      resource,
      allowedContexts,
    });

    const redirect = buildOAuthCallbackUrl({
      redirectUri: input.redirect_uri,
      code,
      state: input.state,
    });

    if (formPost) {
      return NextResponse.redirect(redirect, { status: 302 });
    }

    return NextResponse.json({ redirect_to: redirect.toString() });
  } catch (error) {
    if (error instanceof AgentAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 400 },
    );
  }
}
