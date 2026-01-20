'use client'

// Client-side API helpers
export function getClientApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.location.origin
}

export async function clientFetchFromApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = getClientApiBaseUrl()
  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    let errorMessage = `Failed to fetch from ${endpoint}`
    try {
      const error = await res.json()
      if (error.error) {
        errorMessage = error.error
      } else if (error.details && Array.isArray(error.details)) {
        errorMessage = error.details.map((d: any) => d.message || d).join(', ')
      }
    } catch {
      // If JSON parsing fails, use default message
    }
    const error = new Error(errorMessage)
    ;(error as any).status = res.status
    throw error
  }

  return res.json()
}

export async function createCategory(data: { name: string; type: 'income' | 'expense' }) {
  return clientFetchFromApi('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCategory(id: number, data: { name?: string; type?: 'income' | 'expense' }) {
  return clientFetchFromApi(`/api/categories?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteCategory(id: number) {
  return clientFetchFromApi(`/api/categories?id=${id}`, {
    method: 'DELETE',
  })
}

export async function createPaymentMethod(data: { name: string; type?: 'CARD' | 'CASH' }) {
  return clientFetchFromApi('/api/payment-methods', {
    method: 'POST',
    body: JSON.stringify({ ...data, type: data.type || 'CARD' }),
  })
}

export async function updatePaymentMethod(id: number, data: { name?: string; type?: 'CARD' | 'CASH' }) {
  return clientFetchFromApi(`/api/payment-methods?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deletePaymentMethod(id: number) {
  return clientFetchFromApi(`/api/payment-methods?id=${id}`, {
    method: 'DELETE',
  })
}
