import { NextRequest } from 'next/server';
import { revokeOAuthToken } from '@/lib/server/mcp-oauth/grants';
import {
  oauthErrorResponse,
  oauthOptionsResponse,
} from '@/lib/server/mcp-oauth/cors';

const parseFormBody = async (request: NextRequest) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return request.json() as Promise<Record<string, string>>;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries()) as Record<string, string>;
};

export function OPTIONS() {
  return oauthOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseFormBody(request);
    const token = body.token?.trim();
    if (!token) {
      return oauthErrorResponse('invalid_request', 'Falta token');
    }
    await revokeOAuthToken(token);
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('OAuth revoke error:', error);
    return oauthErrorResponse('server_error', undefined, 500);
  }
}
