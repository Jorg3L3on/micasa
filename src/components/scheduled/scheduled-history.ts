import { formatMonthInPhrase } from '@/lib/calendar-dates';
import type {
  ScheduledHistoryEntry,
  ScheduledHistoryStatus,
} from '@/lib/finance/scheduled-history.service';
import type { StatusTone } from '@/lib/status-tone';

/**
 * "Últimos generados" in the detail (MIC-I16-5): row label and status pill of
 * each record the item created. The block is hidden when there are none.
 */

export const HISTORY_TITLE = 'Últimos generados';

const PERIOD_LABEL = { FIRST: '1ª quincena', SECOND: '2ª quincena' } as const;

/** "1ª quincena · noviembre", with the year when it is not the current one. */
export const historyLabel = (
  entry: Pick<ScheduledHistoryEntry, 'period' | 'month' | 'year'>,
  now: Date = new Date(),
): string => `${PERIOD_LABEL[entry.period]} · ${formatMonthInPhrase(entry.month, entry.year, now)}`;

export const HISTORY_STATUS: Record<ScheduledHistoryStatus, { label: string; tone: StatusTone }> = {
  paid: { label: 'Pagado', tone: 'success' },
  pending: { label: 'Pendiente', tone: 'pending' },
  overdue: { label: 'Vencido', tone: 'overdue' },
  received: { label: 'Recibido', tone: 'success' },
  expected: { label: 'Por recibir', tone: 'pending' },
};

export const historyEndpoint = (kind: 'expense' | 'income', id: number): string =>
  `/api/scheduled-history?kind=${kind}&id=${id}`;
