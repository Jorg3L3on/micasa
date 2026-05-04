'use client';

import type { FinanceContextType } from '@/types/finance-context';

type ApiErrorDetail = {
  message?: string;
} | string;

type ApiErrorResponse = {
  error?: string;
  details?: ApiErrorDetail[];
  code?: string;
};

export type ClientApiError = Error & {
  status?: number;
  details?: ApiErrorDetail[];
  code?: string;
};

/**
 * Builds URLSearchParams for owner context (ownerType, ownerId).
 * Returns empty params if context is missing or invalid (e.g. id 0 before sync).
 * When empty params are sent, the API uses the session user.
 */
export function buildOwnerQuery(
  context?: FinanceContextType,
): URLSearchParams {
  if (!context || (context.type === 'user' && context.id === 0)) {
    return new URLSearchParams();
  }
  return new URLSearchParams({
    ownerType: context.type,
    ownerId: String(context.id),
  });
}

export function getClientApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.origin;
}

export async function clientFetchFromApi<T>(
  endpoint: string,
  options?: RequestInit,
  context?: FinanceContextType,
): Promise<T> {
  let url = endpoint;
  const ownerParams = buildOwnerQuery(context);
  if (ownerParams.toString()) {
    const separator = endpoint.includes('?') ? '&' : '?';
    url = `${endpoint}${separator}${ownerParams.toString()}`;
  }

  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `No se pudo completar la solicitud (${endpoint})`;
    let errorDetails: ApiErrorDetail[] | undefined;
    let apiCode: string | undefined;
    try {
      const error = (await res.json()) as ApiErrorResponse;
      if (typeof error.code === 'string') {
        apiCode = error.code;
      }
      if (error.error) {
        errorMessage = error.error;
      }
      if (error.details && Array.isArray(error.details)) {
        errorDetails = error.details;
        if (errorDetails && errorDetails.length > 0) {
          errorMessage = error.details
            .map((detail) =>
              typeof detail === 'string'
                ? detail
                : (detail.message ?? 'Error en los datos enviados'),
            )
            .join(', ');
        }
      }
    } catch {
      // If JSON parsing fails, use default message
    }
    const error = new Error(errorMessage) as ClientApiError;
    error.status = res.status;
    error.details = errorDetails;
    error.code = apiCode;
    throw error;
  }

  return res.json();
}

/**
 * POST multipart (e.g. file upload). Do not set Content-Type — the browser sets the boundary.
 */
export async function clientFetchMultipartJson<T>(
  endpoint: string,
  formData: FormData,
  context?: FinanceContextType,
): Promise<T> {
  let url = endpoint;
  const ownerParams = buildOwnerQuery(context);
  if (ownerParams.toString()) {
    const separator = endpoint.includes('?') ? '&' : '?';
    url = `${endpoint}${separator}${ownerParams.toString()}`;
  }

  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${url}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    let errorMessage = `No se pudo completar la solicitud (${endpoint})`;
    if (res.status === 413) {
      errorMessage =
        'El archivo supera el límite de tamaño del servidor o del proxy (p. ej. nginx, Vercel). Prueba en local, sube un CSV más pequeño o aumenta client_max_body_size / el límite de tu proveedor.';
    }
    let errorDetails: ApiErrorDetail[] | undefined;
    try {
      const error = (await res.json()) as ApiErrorResponse;
      if (error.error) {
        errorMessage = error.error;
      }
      if (error.details && Array.isArray(error.details)) {
        errorDetails = error.details;
        if (errorDetails && errorDetails.length > 0) {
          errorMessage = error.details
            .map((detail) =>
              typeof detail === 'string'
                ? detail
                : (detail.message ?? 'Error en los datos enviados'),
            )
            .join(', ');
        }
      }
    } catch {
      // keep default message (incl. 413 hint when JSON body is empty)
    }
    const err = new Error(errorMessage) as ClientApiError;
    err.status = res.status;
    err.details = errorDetails;
    throw err;
  }

  return res.json();
}
