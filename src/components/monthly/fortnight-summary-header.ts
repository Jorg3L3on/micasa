export const getFortnightSummaryHeader = (
  period: 'FIRST' | 'SECOND',
): { title: string } => {
  const ordinal = period === 'FIRST' ? '1ª' : '2ª';

  return {
    title: `Resumen de la ${ordinal} quincena`,
  };
};

export type FortnightRemainderTone = 'surplus' | 'shortfall' | 'even' | 'gap';

export type FortnightRemainderCopy = {
  tone: FortnightRemainderTone;
  rowLabel: string;
};

/** Row label for ingreso − toca pagar (absolute amount is formatted by the UI). */
export const getFortnightRemainderCopy = (
  remainder: number,
  options?: { obligationGapCount?: number },
): FortnightRemainderCopy => {
  if ((options?.obligationGapCount ?? 0) > 0 && remainder >= 0) {
    return { tone: 'gap', rowLabel: 'Falta el pago' };
  }
  if (remainder > 0) {
    return { tone: 'surplus', rowLabel: 'Te queda' };
  }
  if (remainder < 0) {
    return { tone: 'shortfall', rowLabel: 'Te falta' };
  }
  return { tone: 'even', rowLabel: 'Te queda' };
};

export type FortnightStatusPillTone = 'shortfall' | 'surplus' | 'even' | 'gap';

export type FortnightStatusPill = {
  tone: FortnightStatusPillTone;
  label: string;
};

/** Compact status chip beside the resumen title (no amount — that lives in the ledger). */
export const getFortnightStatusPill = (
  remainder: number,
  options?: { obligationGapCount?: number },
): FortnightStatusPill => {
  if ((options?.obligationGapCount ?? 0) > 0 && remainder >= 0) {
    return { tone: 'gap', label: 'Falta el pago' };
  }
  if (remainder > 0) {
    return { tone: 'surplus', label: 'Alcanza' };
  }
  if (remainder < 0) {
    return { tone: 'shortfall', label: 'Te falta' };
  }
  return { tone: 'even', label: 'Justo' };
};

export type DueToPayCompositionRow = {
  label: string;
  amount: number;
};

export type DueToPayCompositionInput = {
  pagado: number;
  pendiente: number;
  statementDue?: number;
  walletLoanDue?: number;
  payrollDeduction?: number;
};

/**
 * Non-zero breakdown rows for the “Toca pagar” tooltip.
 * Budget remaining is a sibling ledger line, not part of this composition.
 * Order matches how commitment is explained in the planner.
 */
export const getDueToPayComposition = (
  input: DueToPayCompositionInput,
): DueToPayCompositionRow[] => {
  const rows: DueToPayCompositionRow[] = [];

  if (input.pagado > 0) {
    rows.push({ label: 'Ya pagado', amount: input.pagado });
  }
  if (input.pendiente > 0) {
    rows.push({ label: 'Pendiente de gastos', amount: input.pendiente });
  }
  if ((input.statementDue ?? 0) > 0) {
    rows.push({
      label: 'De eso, estado de cuenta',
      amount: input.statementDue ?? 0,
    });
  }
  if ((input.walletLoanDue ?? 0) > 0) {
    rows.push({
      label: 'De eso, cuotas de préstamo',
      amount: input.walletLoanDue ?? 0,
    });
  }
  if ((input.payrollDeduction ?? 0) > 0) {
    rows.push({
      label: 'Deducciones de nómina',
      amount: input.payrollDeduction ?? 0,
    });
  }

  return rows;
};
