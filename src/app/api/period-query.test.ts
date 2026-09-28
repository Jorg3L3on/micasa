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
  handler: (request: Request) => Promise<Response>,
  path: string,
) => {
  const response = await handler(new Request(`http://localhost${path}`));
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

  it('rejects a garbage period on GET /api/fortnights', async () => {
    const response = await getJson(
      getFortnights,
      '/api/fortnights?year=2026&month=9&period=THIRD',
    );
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'period must be FIRST or SECOND' });
    expect(findFortnightByCalendarPeriod).not.toHaveBeenCalled();
  });

  it('normalizes period=1 and rejects garbage on reports, alerts, and transactions', async () => {
    const report = await getJson(
      getReports,
      '/api/reports?type=summary&year=2026&month=9&period=1',
    );
    expect(report.status).toBe(200);
    expect(getReportSummary).toHaveBeenCalledWith(
      expect.objectContaining({ period: FortnightPeriod.FIRST }),
    );

    const reportGarbage = await getJson(
      getReports,
      '/api/reports?type=summary&year=2026&month=9&period=foo',
    );
    expect(reportGarbage.status).toBe(400);
    expect(reportGarbage.body.error).toBe('period must be FIRST or SECOND');

    const alerts = await getJson(
      getAlertsRoute,
      '/api/alerts?year=2026&month=9&period=2',
    );
    expect(alerts.status).toBe(200);
    expect(getAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ period: FortnightPeriod.SECOND }),
    );

    const alertsGarbage = await getJson(
      getAlertsRoute,
      '/api/alerts?year=2026&month=9&period=nope',
    );
    expect(alertsGarbage.status).toBe(400);

    const transactions = await getJson(
      getTransactions,
      '/api/transactions?year=2026&month=9&period=1',
    );
    expect(transactions.status).toBe(200);
    expect(listPlanningTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ period: FortnightPeriod.FIRST }),
    );

    const transactionsGarbage = await getJson(
      getTransactions,
      '/api/transactions?year=2026&month=9&period=9',
    );
    expect(transactionsGarbage.status).toBe(400);
    expect(transactionsGarbage.body.error).toBe('period must be FIRST or SECOND');
  });
});
