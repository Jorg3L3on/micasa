export const getFortnightSummaryHeader = (
  period: 'FIRST' | 'SECOND',
): { title: string } => {
  const ordinal = period === 'FIRST' ? '1ª' : '2ª';

  return {
    title: `Resumen de la ${ordinal} quincena`,
  };
};

export type FortnightRemainderTone = 'surplus' | 'shortfall' | 'even';

export type FortnightRemainderCopy = {
  tone: FortnightRemainderTone;
  headline: string;
  rowLabel: string;
};

/** Headline + row label for ingreso − toca pagar (absolute amount is formatted by the UI). */
export const getFortnightRemainderCopy = (
  remainder: number,
): FortnightRemainderCopy => {
  if (remainder > 0) {
    return { tone: 'surplus', headline: 'Te sobran', rowLabel: 'Queda' };
  }
  if (remainder < 0) {
    return { tone: 'shortfall', headline: 'Te faltan', rowLabel: 'Falta' };
  }
  return { tone: 'even', headline: 'Quedas a mano', rowLabel: 'Queda' };
};
