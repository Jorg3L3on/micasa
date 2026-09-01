import { formatFortnightDateRangeLabel } from '@/lib/fortnight-calendar';

export const getFortnightSummaryHeader = (
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): { title: string; dateRange: string } => {
  const ordinal = period === 'FIRST' ? '1ª' : '2ª';

  return {
    title: `Resumen de la ${ordinal} quincena`,
    dateRange: formatFortnightDateRangeLabel(year, month, period),
  };
};
