import { z } from 'zod';

const clientMetadataSchema = z.object({
  client_id: z.string().url(),
  client_name: z.string().min(1),
  redirect_uris: z.array(z.string().url()).min(1),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
  client_uri: z.string().url().optional(),
  logo_uri: z.string().url().optional(),
});

export type ClientIdMetadataDocument = z.infer<typeof clientMetadataSchema>;

export const isClientIdMetadataUrl = (clientId: string): boolean => {
  try {
    const url = new URL(clientId);
    return url.protocol === 'https:' && url.pathname.length > 1;
  } catch {
    return false;
  }
};

export const fetchClientIdMetadataDocument = async (
  clientId: string,
): Promise<ClientIdMetadataDocument | null> => {
  if (!isClientIdMetadataUrl(clientId)) return null;

  const response = await fetch(clientId, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const json: unknown = await response.json();
  const parsed = clientMetadataSchema.safeParse(json);
  if (!parsed.success) return null;
  if (parsed.data.client_id !== clientId) return null;
  return parsed.data;
};

export const validateRedirectUri = (
  redirectUri: string,
  allowedUris: string[],
): boolean => allowedUris.includes(redirectUri);
