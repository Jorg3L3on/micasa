import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FortnightPeriod } from '@/generated/prisma/client';

const {
  getOwnerContext,
  findFortnightByCalendarPeriod,
  listFortnightsForCatalog,
  getReportSummary,
  getAlerts,
  listPlanningTransactions,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findFortnightByCalendarPeriod: vi.fn(),
  listFortnightsForCatalog: vi.fn(),
  getReportSummary: vi.fn(),
  getAlerts: vi.fn(),
  listPlanningTransactions: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/features/monthly/server/monthly.queries', () => ({
  findFortnightByCalendarPeriod,
}));

vi.mock('@/lib/finance/fortnight.service', () => ({
  listFortnightsForCatalog,
}));

vi.mock('@/lib/finance/report-summary.service', () => ({
  getReportSummary,
}));

vi.mock('@/features/alerts/server/alerts.service', () => ({
  getAlerts,
}));

vi.mock('@/lib/finance/planning-transactions.service', () => ({
  listPlanningTransactions,
}));

vi.mock('@/lib/prisma', () => ({
  default: {},
}));

import { GET as getFortnights } from './fortnights/route';
import { GET as getReports } from './reports/route';
import { GET as getAlertsRoute } from './alerts/route';
import { GET as getTransactions } from './transactions/route';

const ownerContext = {
  userId: 1,
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
  role: 'owner' as const,
};

const getJson = async (
  handler: (request: NextRequest) => Promise<Response>,
  path: string,
) => {
  const response = await handler(new NextRequest(`http://localhost${path}`));
  return { status: response.status, body: await response.json() };
};

describe('period query normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(ownerContext);
    findFortnightByCalendarPeriod.mockResolvedValue({
      id: 7,
      label: '1ª quincena',
      period: FortnightPeriod.FIRST,
    });
    listFortnightsForCatalog.mockResolvedValue([]);
    getReportSummary.mockResolvedValue({ totalIncome: 0 });
    getAlerts.mockResolvedValue({ alerts: [] });
    listPlanningTransactions.mockResolvedValue([]);
  });

  it('normalizes period=1 and period=2 on GET /api/fortnights', async () => {
    const first = await getJson(
      getFortnights,
      '/api/fortnights?year=2026&month=9&period=1',
    );
    expect(first.status).toBe(200);
    expect(first.body.period).toBe(FortnightPeriod.FIRST);
    expect(findFortnightByCalendarPeriod).toHaveBeenCalledWith(
      ownerContext.ownerFilter,
      2026,
      9,
      FortnightPeriod.FIRST,
    );

    findFortnightByCalendarPeriod.mockResolvedValueOnce({
      id: 8,
      label: '2ª quincena',
      period: FortnightPeriod.SECOND,
    });
    const second = await getJson(
      getFortnights,
      '/api/fortnights?year=2026&month=9&period=2',
    );
    expect(second.status).toBe(200);
    expect(second.body.period).toBe(FortnightPeriod.SECOND);
    expect(findFortnightByCalendarPeriod).toHaveBeenLastCalledWith(
      ownerContext.ownerFilter,
      2026,
      9,
      FortnightPeriod.SECOND,
    );
  });

  it('rejects an empty or whitespace period on fortnights and lists the catalog when it is absent', async () => {
    for (const path of [
      '/api/fortnights?year=2026&month=9&period=',
      '/api/fortnights?year=2026&month=9&period=%20%20',
    ]) {
      const response = await getJson(getFortnights, path);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'period must be FIRST or SECOND' });
    }
    expect(findFortnightByCalendarPeriod).not.toHaveBeenCalled();

    const missing = await getJson(getFortnights, '/api/fortnights');
    expect(missing.status).toBe(200);
    expect(listFortnightsForCatalog).toHaveBeenCalled();
  });

  it('treats an empty or whitespace period like a missing one on reports, alerts, and transactions', async () => {
    const reportMissing = await getJson(
      getReports,
      '/api/reports?type=summary&year=2026&month=9',
    );
    const reportEmpty = await getJson(
      getReports,
      '/api/reports?type=summary&year=2026&month=9&period=',
    );
    const reportSpaces = await getJson(
      getReports,
      '/api/reports?type=summary&year=2026&month=9&period=%20%20',
    );
    expect([reportMissing.status, reportEmpty.status, reportSpaces.status]).toEqual([
      200, 200, 200,
    ]);
    const reportCalls = getReportSummary.mock.calls.map((call) => call[0]);
    expect(reportCalls[1]).toEqual(reportCalls[0]);
    expect(reportCalls[2]).toEqual(reportCalls[0]);
    expect(reportCalls[0].period).toBeUndefined();

    const alertsMissing = await getJson(
      getAlertsRoute,
      '/api/alerts?year=2026&month=9',
    );
    const alertsEmpty = await getJson(
      getAlertsRoute,
      '/api/alerts?year=2026&month=9&period=',
    );
    const alertsSpaces = await getJson(
      getAlertsRoute,
      '/api/alerts?year=2026&month=9&period=%20%20',
    );
    expect([alertsMissing.status, alertsEmpty.status, alertsSpaces.status]).toEqual([
      200, 200, 200,
    ]);
    const alertCalls = getAlerts.mock.calls.map((call) => call[0]);
    expect(alertCalls[1]).toEqual(alertCalls[0]);
    expect(alertCalls[2]).toEqual(alertCalls[0]);
    expect(alertCalls[0].period).toBeNull();

    const transactionsMissing = await getJson(
      getTransactions,
      '/api/transactions?year=2026&month=9',
    );
    const transactionsEmpty = await getJson(
      getTransactions,
      '/api/transactions?year=2026&month=9&period=',
    );
    const transactionsSpaces = await getJson(
      getTransactions,
      '/api/transactions?year=2026&month=9&period=%20%20',
    );
    expect([
      transactionsMissing.status,
      transactionsEmpty.status,
      transactionsSpaces.status,
    ]).toEqual([200, 200, 200]);
    const transactionCalls = listPlanningTransactions.mock.calls.map(
      (call) => call[0],
    );
    expect(transactionCalls[1]).toEqual(transactionCalls[0]);
    expect(transactionCalls[2]).toEqual(transactionCalls[0]);
    expect(transactionCalls[0].period).toBeUndefined();
  });

  it('rejects garbage periods on fortnights, reports, alerts, and transactions', async () => {
    const cases: Array<
      [(request: NextRequest) => Promise<Response>, string]
    > = [
      [getFortnights, '/api/fortnights?year=2026&month=9&period=abc'],
      [getFortnights, '/api/fortnights?year=2026&month=9&period=undefined'],
      [getFortnights, '/api/fortnights?year=2026&month=9&period=THIRD'],
      [getReports, '/api/reports?type=summary&year=2026&month=9&period=abc'],
      [getReports, '/api/reports?type=summary&year=2026&month=9&period=undefined'],
      [getReports, '/api/reports?type=summary&year=2026&month=9&period=foo'],
      [getAlertsRoute, '/api/alerts?year=2026&month=9&period=abc'],
      [getAlertsRoute, '/api/alerts?year=2026&month=9&period=undefined'],
      [getAlertsRoute, '/api/alerts?year=2026&month=9&period=nope'],
      [getTransactions, '/api/transactions?year=2026&month=9&period=abc'],
      [getTransactions, '/api/transactions?year=2026&month=9&period=undefined'],
      [getTransactions, '/api/transactions?year=2026&month=9&period=9'],
    ];

    for (const [handler, path] of cases) {
      const response = await getJson(handler, path);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('period must be FIRST or SECOND');
    }
    expect(findFortnightByCalendarPeriod).not.toHaveBeenCalled();
    expect(getReportSummary).not.toHaveBeenCalled();
    expect(getAlerts).not.toHaveBeenCalled();
    expect(listPlanningTransactions).not.toHaveBeenCalled();
  });

  it('normalizes period=1 and period=2 on reports, alerts, and transactions', async () => {
    const report = await getJson(
      getReports,
      '/api/reports?type=summary&year=2026&month=9&period=1',
    );
    expect(report.status).toBe(200);
    expect(getReportSummary).toHaveBeenCalledWith(
      expect.objectContaining({ period: FortnightPeriod.FIRST }),
    );

    const alerts = await getJson(
      getAlertsRoute,
      '/api/alerts?year=2026&month=9&period=2',
    );
    expect(alerts.status).toBe(200);
    expect(getAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ period: FortnightPeriod.SECOND }),
    );

    const transactions = await getJson(
      getTransactions,
      '/api/transactions?year=2026&month=9&period=1',
    );
    expect(transactions.status).toBe(200);
    expect(listPlanningTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ period: FortnightPeriod.FIRST }),
    );
  });
});
