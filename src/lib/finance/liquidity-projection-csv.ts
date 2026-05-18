import type { LiquidityProjectionResult } from '@/lib/finance/liquidity-projection.service';

const csvEscape = (value: string | number | boolean | undefined | null) => {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export const liquidityProjectionToCsv = (
  data: LiquidityProjectionResult,
): string => {
  const lines: string[] = [
    [
      'due_date',
      'source',
      'wallet_id',
      'wallet_name',
      'amount',
      'statement_start',
      'statement_end',
      'expense_id',
      'template_id',
      'loan_payment_id',
      'loan_name',
      'is_estimate',
      'stress_adjustment',
    ].join(','),
  ];

  for (const m of data.milestones) {
    for (const o of m.obligations) {
      lines.push(
        [
          csvEscape(m.due_date),
          csvEscape(o.source),
          csvEscape(o.wallet_id),
          csvEscape(o.wallet_name),
          csvEscape(o.next_due_payment),
          csvEscape(o.statement_start),
          csvEscape(o.statement_end),
          csvEscape(o.expense_id),
          csvEscape(o.expense_template_id),
          csvEscape(o.loan_payment_id),
          csvEscape(o.loan_name),
          csvEscape(o.is_estimate ?? false),
          csvEscape(o.stress_adjustment ?? ''),
        ].join(','),
      );
    }
  }

  lines.push('');
  lines.push(
    `summary,funding_total,${data.summary.funding_total},obligations_total,${data.summary.total_obligations_due_on_or_before_until},shortfall,${data.summary.shortfall_versus_funding}`,
  );
  return lines.join('\n');
};
