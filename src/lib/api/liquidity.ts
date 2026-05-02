'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import {
  buildOwnerQuery,
  getClientApiBaseUrl,
  clientFetchFromApi,
} from '@/lib/api/client-fetch';

export type FetchLiquidityProjectionParams = {
  until?: string;
  omitZero?: boolean;
  stressCyclePercent?: number;
  includeUnpaid?: boolean;
  includeTemplates?: boolean;
};

const appendLiquiditySearchParams = (
  search: URLSearchParams,
  params: FetchLiquidityProjectionParams,
) => {
  if (params.until) {
    search.set('until', params.until);
  }
  if (params.omitZero === false) {
    search.set('omitZero', 'false');
  }
  if (
    params.stressCyclePercent != null &&
    params.stressCyclePercent > 0
  ) {
    search.set('stressCyclePercent', String(params.stressCyclePercent));
  }
  if (params.includeUnpaid === false) {
    search.set('includeUnpaid', 'false');
  }
  if (params.includeTemplates === true) {
    search.set('includeTemplates', 'true');
  }
};

export async function fetchLiquidityProjection(
  params: FetchLiquidityProjectionParams,
  context?: FinanceContextType,
): Promise<LiquidityProjectionResponse> {
  const search = new URLSearchParams();
  appendLiquiditySearchParams(search, params);
  const ownerParams = buildOwnerQuery(context);
  ownerParams.forEach((v, k) => {
    search.set(k, v);
  });
  const qs = search.toString();
  const path = `/api/wallets/liquidity-projection${qs ? `?${qs}` : ''}`;
  return clientFetchFromApi<LiquidityProjectionResponse>(path, undefined);
}

export const downloadLiquidityProjectionCsv = async (
  params: FetchLiquidityProjectionParams,
  context?: FinanceContextType,
): Promise<void> => {
  const search = new URLSearchParams();
  appendLiquiditySearchParams(search, params);
  search.set('format', 'csv');
  const ownerParams = buildOwnerQuery(context);
  ownerParams.forEach((v, k) => {
    search.set(k, v);
  });
  const qs = search.toString();
  const path = `/api/wallets/liquidity-projection?${qs}`;
  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, { credentials: 'include' });
  if (!res.ok) {
    let message = 'No se pudo descargar el CSV';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'liquidez.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
