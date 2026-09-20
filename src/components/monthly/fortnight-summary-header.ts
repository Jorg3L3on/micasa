export const getFortnightSummaryHeader = (
  period: 'FIRST' | 'SECOND',
): { title: string } => {
  const ordinal = period === 'FIRST' ? '1ª' : '2ª';

  return {
    title: `Resumen de la ${ordinal} quincena`,
  };
};
