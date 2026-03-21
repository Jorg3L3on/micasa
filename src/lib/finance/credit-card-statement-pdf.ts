import { jsPDF } from 'jspdf';
import type { CreditCardStatementResponse } from '@/types/catalog';
import { formatCurrency, formatDate } from '@/lib/utils';

const MARGIN_X = 14;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 18;
const LINE = 5;
const LINE_SM = 4;

const buildPdfFileBaseName = (cardName: string, cycleStart: string) => {
  const safe = cardName.replace(/[^\w\d-]+/g, '_').slice(0, 40);
  return `tarjeta_${safe}_${cycleStart}`;
};

/** Returns possibly adjusted y; mutates doc with addPage when needed */
const ensureSpace = (doc: jsPDF, y: number, neededMm: number): number => {
  const h = doc.internal.pageSize.getHeight();
  if (y + neededMm > h - MARGIN_BOTTOM) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
};

const writeSectionTitle = (doc: jsPDF, y: number, title: string): number => {
  const baseY = ensureSpace(doc, y, LINE * 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(title, MARGIN_X, baseY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  return baseY + LINE + 1;
};

const writeKeyValue = (doc: jsPDF, y: number, label: string, value: string): number => {
  const baseY = ensureSpace(doc, y, LINE);
  doc.setFont('helvetica', 'bold');
  doc.text(`${label}:`, MARGIN_X, baseY);
  const labelW = doc.getTextWidth(`${label}:`);
  doc.setFont('helvetica', 'normal');
  doc.text(value, MARGIN_X + labelW + 2, baseY);
  return baseY + LINE;
};

const writePurchaseRows = (
  doc: jsPDF,
  y: number,
  items: CreditCardStatementResponse['current_cycle_purchase_items'],
): number => {
  const pageW = doc.internal.pageSize.getWidth();
  const amountX = pageW - MARGIN_X;
  const textMaxW = pageW - MARGIN_X * 2 - 32;

  let nextY = y;
  for (const row of items) {
    const amountStr = formatCurrency(row.amount);
    const meta = `${formatDate(row.payment_date)} · ${row.category}`;
    nextY = ensureSpace(doc, nextY, LINE * 3);
    doc.setFontSize(9);
    doc.text(meta, MARGIN_X, nextY);
    doc.text(amountStr, amountX, nextY, { align: 'right' });
    nextY += LINE_SM;
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(row.description, textMaxW);
    nextY = ensureSpace(doc, nextY, LINE_SM * descLines.length);
    doc.text(descLines, MARGIN_X, nextY);
    nextY += descLines.length * LINE_SM + 3;
  }
  return nextY;
};

const writePaymentRows = (
  doc: jsPDF,
  y: number,
  items: CreditCardStatementResponse['payment_history'],
): number => {
  const pageW = doc.internal.pageSize.getWidth();
  const amountX = pageW - MARGIN_X;
  let nextY = y;

  for (const row of items) {
    const line = `${formatDate(row.paid_at)} · ${row.source_wallet_name}${
      row.note ? ` · ${row.note}` : ''
    }`;
    const lines = doc.splitTextToSize(line, pageW - MARGIN_X * 2 - 36);
    nextY = ensureSpace(doc, nextY, LINE_SM * lines.length + LINE);
    doc.setFontSize(9);
    doc.text(lines, MARGIN_X, nextY);
    doc.text(formatCurrency(row.amount), amountX, nextY, { align: 'right' });
    nextY += lines.length * LINE_SM + 3;
  }
  return nextY;
};

export const buildCreditCardStatementPdfBlob = (
  cardName: string,
  statement: CreditCardStatementResponse,
): Blob => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();

  let y = MARGIN_TOP;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(24, 24, 27);
  doc.text('Estado de cuenta — Tarjeta', MARGIN_X, y);
  y += LINE + 3;

  doc.setFontSize(11);
  doc.text(cardName, MARGIN_X, y);
  y += LINE + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 90);
  doc.text(
    `Ciclo mostrado: ${formatDate(statement.current_cycle_start)} – ${formatDate(statement.current_cycle_end)}`,
    MARGIN_X,
    y,
  );
  y += LINE;
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, MARGIN_X, y);
  y += LINE + 4;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);

  y = writeSectionTitle(doc, y, 'Resumen');
  y = writeKeyValue(doc, y, 'Deuda actual', formatCurrency(statement.outstanding_balance));
  y = writeKeyValue(
    doc,
    y,
    'Crédito disponible',
    statement.available_credit == null
      ? 'Sin línea'
      : formatCurrency(statement.available_credit),
  );
  y = writeKeyValue(doc, y, 'Pago próximo', formatCurrency(statement.next_due_payment));
  y = writeKeyValue(
    doc,
    y,
    'Vencimiento',
    formatDate(statement.statement_due_date),
  );
  y = writeKeyValue(
    doc,
    y,
    'Periodo facturado',
    `${formatDate(statement.statement_start)} al ${formatDate(statement.statement_end)}`,
  );
  y = writeKeyValue(
    doc,
    y,
    'Saldo del corte',
    formatCurrency(statement.last_statement_balance),
  );
  y += 3;

  y = writeSectionTitle(doc, y, 'Compras del ciclo actual');
  if (statement.current_cycle_purchase_items.length === 0) {
    y = ensureSpace(doc, y, LINE);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    doc.text('Sin compras en este ciclo.', MARGIN_X, y);
    doc.setTextColor(30, 30, 30);
    y += LINE + 3;
  } else {
    y = writePurchaseRows(doc, y, statement.current_cycle_purchase_items);
  }

  y = writeSectionTitle(doc, y, 'Compras del último corte');
  if (statement.statement_purchases.length === 0) {
    y = ensureSpace(doc, y, LINE);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    doc.text('Sin compras en el último corte.', MARGIN_X, y);
    doc.setTextColor(30, 30, 30);
    y += LINE + 3;
  } else {
    y = writePurchaseRows(doc, y, statement.statement_purchases);
  }

  y = writeSectionTitle(doc, y, 'Historial de pagos');
  if (statement.payment_history.length === 0) {
    y = ensureSpace(doc, y, LINE);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    doc.text('Sin pagos registrados.', MARGIN_X, y);
    doc.setTextColor(30, 30, 30);
    y += LINE + 2;
  } else {
    y = writePaymentRows(doc, y, statement.payment_history);
  }

  const totalPages = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 130);
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.text(
      `MiCasa · Página ${p} de ${totalPages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' },
    );
  }

  return doc.output('blob');
};

export const downloadCreditCardStatementPdf = (
  cardName: string,
  statement: CreditCardStatementResponse,
) => {
  const blob = buildCreditCardStatementPdfBlob(cardName, statement);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${buildPdfFileBaseName(cardName, statement.current_cycle_start)}.pdf`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
