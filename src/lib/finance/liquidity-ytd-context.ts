export type MonthlySummaryLike = {
  year: number;
  month: number;
  expense: number;
};

export type LiquidityYtdContext = {
  currentYear: number;
  spentYtd: number;
  debtPaidYtd: number;
  ratioLabel: string | null;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/** Calendar-year YTD: household spending vs debt payments (tarjetas + préstamos). */
export const buildLiquidityYtdContext = (input: {
  asOfYmd: string;
  monthlySummary: readonly MonthlySummaryLike[];
  totalSpentYtd: number;
}): LiquidityYtdContext => {
  const [currentYear, currentMonth] = input.asOfYmd.split('-').map(Number);

  const debtPaidYtd = roundMoney(
    input.monthlySummary.reduce((sum, row) => {
      if (row.year !== currentYear || row.month > currentMonth) return sum;
      return sum + row.expense;
    }, 0),
  );

  const spentYtd = roundMoney(Math.max(0, input.totalSpentYtd));

  let ratioLabel: string | null = null;
  if (spentYtd > 0 && debtPaidYtd > 0) {
    const debtShare = Math.round((debtPaidYtd / spentYtd) * 100);
    ratioLabel = `${debtShare}% de lo que gastaste fue a deudas`;
  } else if (spentYtd > 0 && debtPaidYtd === 0) {
    ratioLabel = 'Aún no registras pagos de deuda este año';
  } else if (spentYtd === 0 && debtPaidYtd > 0) {
    ratioLabel = 'Pagaste deudas pero aún no hay gastos registrados este año';
  }

  return {
    currentYear,
    spentYtd,
    debtPaidYtd,
    ratioLabel,
  };
};
