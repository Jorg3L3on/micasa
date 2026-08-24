import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import { getMcpResourceUrl, parseScopeParam } from '@/lib/server/mcp-oauth/config';
import { createAuthorizationCode } from '@/lib/server/mcp-oauth/grants';

const consentSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  state: z.string().optional(),
  scope: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url().optional(),
  allow_write: z.enum(['true', 'false']).optional(),
});

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
    const body = await request.json();
    const input = consentSchema.parse(body);
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

    const code = await createAuthorizationCode({
      clientId: input.client_id,
      userId,
      redirectUri: input.redirect_uri,
      scopes,
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method,
      resource: input.resource ?? getMcpResourceUrl(request),
    });

    const redirect = new URL(input.redirect_uri);
    redirect.searchParams.set('code', code);
    if (input.state) redirect.searchParams.set('state', input.state);

    return NextResponse.json({ redirect_to: redirect.toString() });
  } catch (error) {
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
