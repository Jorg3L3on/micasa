const MONTH_NAMES_LOWER = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export const getFortnightSummaryHeader = (
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): { title: string; dateRange: string } => {
  const monthName = MONTH_NAMES_LOWER[month - 1] ?? '';
  const ordinal = period === 'FIRST' ? '1ª' : '2ª';
  const lastDay = new Date(year, month, 0).getDate();
  const dateRange =
    period === 'FIRST'
      ? `1 al 15 de ${monthName}`
      : `16 al ${lastDay} de ${monthName}`;

  return {
    title: `Resumen de la ${ordinal} quincena`,
    dateRange,
  };
};
