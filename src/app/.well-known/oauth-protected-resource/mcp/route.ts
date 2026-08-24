import { buildProtectedResourceMetadata } from '@/lib/server/mcp-oauth/metadata';
import { oauthJsonResponse, oauthOptionsResponse } from '@/lib/server/mcp-oauth/cors';

/** ChatGPT probes `/.well-known/oauth-protected-resource/mcp` (not `/api/mcp`). */
export function OPTIONS() {
  return oauthOptionsResponse();
}

export function GET(request: Request) {
  return oauthJsonResponse(buildProtectedResourceMetadata(request), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
