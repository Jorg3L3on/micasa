'use client';

import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import type { FinanceContextType } from '@/types/finance-context';
import type { AuditBatchDto, AuditPage, AuditRowDto, AuthEventDto } from '@/types/audit';

export type AuditFilters = {
  actorUserId?: number;
  entityType?: string;
  entityId?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  source?: 'WEB' | 'AGENT' | 'ADMIN' | 'SYSTEM';
  sessionId?: string;
  batchId?: string;
  from?: string;
  to?: string;
  includeFortnights?: boolean;
};

export const auditQueryString = (
  filters: AuditFilters,
  extra: Record<string, string | number | undefined> = {},
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value === undefined || value === '' || value === false) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const fetchAuditBatches = (
  filters: AuditFilters,
  context: FinanceContextType,
  cursor?: string,
) =>
  clientFetchFromApi<AuditPage<AuditBatchDto>>(
    `/api/audit${auditQueryString(filters, { groupBy: 'batch', limit: 30, cursor })}`,
    undefined,
    context,
  );

export const fetchAuditRows = (
  filters: AuditFilters,
  context: FinanceContextType,
  cursor?: string,
) =>
  clientFetchFromApi<AuditPage<AuditRowDto>>(
    `/api/audit${auditQueryString(filters, { limit: 50, cursor })}`,
    undefined,
    context,
  );

export const fetchAuditSessions = (
  filters: { userId?: number; kind?: string; from?: string; to?: string },
  context: FinanceContextType,
  cursor?: string,
) =>
  clientFetchFromApi<AuditPage<AuthEventDto>>(
    `/api/audit/sessions${auditQueryString(filters, { limit: 40, cursor })}`,
    undefined,
    context,
  );

/** Same filters as the list; the browser downloads the CSV. */
export const auditExportHref = (filters: AuditFilters, context: FinanceContextType): string => {
  const query = auditQueryString(filters);
  const owner = buildOwnerQuery(context).toString();
  const joined = [query.replace(/^\?/, ''), owner].filter(Boolean).join('&');
  return `/api/audit/export${joined ? `?${joined}` : ''}`;
};
