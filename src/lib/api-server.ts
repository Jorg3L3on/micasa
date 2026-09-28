import { headers } from 'next/headers'
import {
  NETWORK_ERROR_MESSAGE,
  isBrowserNetworkError,
} from '@/lib/user-facing-error'

export type OwnerContext = {
  ownerType?: 'user' | 'house'
  ownerId?: number
}

export async function getApiBaseUrl(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  return `${protocol}://${host}`
}

function buildUrlWithOwnerContext(
  endpoint: string,
  ownerContext?: OwnerContext,
): string {
  if (!ownerContext?.ownerType || ownerContext.ownerId == null) {
    return endpoint
  }
  const ownerParams = new URLSearchParams({
    ownerType: ownerContext.ownerType,
    ownerId: String(ownerContext.ownerId),
  })
  const separator = endpoint.includes('?') ? '&' : '?'
  return `${endpoint}${separator}${ownerParams.toString()}`
}

export async function fetchFromApi<T>(
  endpoint: string,
  ownerContext?: OwnerContext,
): Promise<T> {
  const headersList = await headers()
  const baseUrl = await getApiBaseUrl()
  const cookie = headersList.get('cookie')
  const url = buildUrlWithOwnerContext(endpoint, ownerContext)
  let res: Response
  try {
    res = await fetch(`${baseUrl}${url}`, {
      cache: 'no-store',
      headers: cookie ? { cookie } : undefined,
    })
  } catch (error) {
    if (isBrowserNetworkError(error)) {
      throw new Error(NETWORK_ERROR_MESSAGE)
    }
    throw error
  }

  if (!res.ok) {
    throw new Error(
      `Failed to fetch from ${endpoint} (HTTP ${res.status})`,
    );
  }

  return res.json()
}
