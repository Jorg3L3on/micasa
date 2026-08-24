import { buildAuthorizationServerMetadata } from '@/lib/server/mcp-oauth/metadata';
import { oauthJsonResponse, oauthOptionsResponse } from '@/lib/server/mcp-oauth/cors';

/** ChatGPT probes `/.well-known/oauth-authorization-server/mcp`. */
export function OPTIONS() {
  return oauthOptionsResponse();
}

export function GET(request: Request) {
  return oauthJsonResponse(buildAuthorizationServerMetadata(request), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
