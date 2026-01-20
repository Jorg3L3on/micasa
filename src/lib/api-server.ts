import { headers } from 'next/headers'

export async function getApiBaseUrl(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  return `${protocol}://${host}`
}

export async function fetchFromApi<T>(endpoint: string): Promise<T> {
  const baseUrl = await getApiBaseUrl()
  const res = await fetch(`${baseUrl}${endpoint}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch from ${endpoint}`)
  }

  return res.json()
}
