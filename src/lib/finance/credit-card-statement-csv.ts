import type { CreditCardStatementResponse } from '@/types/catalog';

const csvEscape = (value: string) => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const buildCreditCardStatementCsv = (
  cardName: string,
  statement: CreditCardStatementResponse,
): string => {
  const lines: string[] = [];
  lines.push(csvEscape(`Tarjeta: ${cardName}`));
  lines.push(
    csvEscape(
      `Ciclo actual: ${statement.current_cycle_start} – ${statement.current_cycle_end}`,
    ),
  );
  lines.push('');
  lines.push('Compras ciclo actual;Fecha;Categoría;Monto');
  for (const row of statement.current_cycle_purchase_items) {
    lines.push(
      [
        csvEscape(row.description),
        row.payment_date,
        csvEscape(row.category),
        String(row.amount),
      ].join(';'),
    );
  }
  lines.push('');
  lines.push('Compras último corte;Fecha;Categoría;Monto');
  for (const row of statement.statement_purchases) {
    lines.push(
      [
        csvEscape(row.description),
        row.payment_date,
        csvEscape(row.category),
        String(row.amount),
      ].join(';'),
    );
  }
  lines.push('');
  lines.push('Pagos;Fecha;Origen;Monto;Nota');
  for (const row of statement.payment_history) {
    lines.push(
      [
        '',
        row.paid_at,
        csvEscape(row.source_wallet_name),
        String(row.amount),
        csvEscape(row.note ?? ''),
      ].join(';'),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
};

export const downloadCreditCardStatementCsv = (
  cardName: string,
  statement: CreditCardStatementResponse,
) => {
  const blob = new Blob([buildCreditCardStatementCsv(cardName, statement)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = cardName.replace(/[^\w\d-]+/g, '_').slice(0, 40);
  a.download = `tarjeta_${safe}_${statement.current_cycle_start}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
