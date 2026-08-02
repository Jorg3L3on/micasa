import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type PeriodView = 'month' | 'biweekly';

export type AlertTarget = {
  path: string;
  query?: Record<string, string | number>;
};

export type FinanceAlert = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  target: AlertTarget;
  fingerprint: string;
};

export type AlertsPeriod = {
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
};

export type AlertsResponse = {
  period: AlertsPeriod;
  alerts: FinanceAlert[];
};

export type GetAlertsParams = {
  ownerFilter: OwnerFilter;
  view?: PeriodView;
  month?: string | null;
  year?: string | null;
  period?: 'FIRST' | 'SECOND' | null;
};

export type ResolvedAlertsPeriod = {
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
};
