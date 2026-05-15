/**
 * Parser for Mercado Pago (Mexico) credit card PDF statements.
 * Expects text extracted via unpdf (see extractMercadoPagoStatementText).
 */

import '@/lib/polyfills';
import { parseInstallmentFromDescription } from '@/lib/finance/expense-planning-scope';

const MONTHS_ES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const normalizeMonthToken = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const parseMoneyAtEnd = (line: string): number | null => {
  const re = /\$\s*([\d,]+\.\d{2})/g;
  let last: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const cleaned = m[1].replace(/,/g, '');
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n)) {
      last = n;
    }
  }
  return last;
};

const addDaysUtc = (d: Date, days: number): Date => {
  const t = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + days,
    12,
    0,
    0,
    0,
  );
  return new Date(t);
};

const pickTransactionDate = (
  day: number,
  month: number,
  periodEnd: Date,
  statementYear: number,
): Date => {
  const endPlus = addDaysUtc(periodEnd, 14);
  const candidates: Date[] = [];
  for (let dy = 0; dy <= 3; dy += 1) {
    const y = statementYear - dy;
    const dt = new Date(Date.UTC(y, month - 1, day, 12, 0, 0, 0));
    if (dt.getTime() <= endPlus.getTime()) {
      candidates.push(dt);
    }
  }
  if (candidates.length === 0) {
    return new Date(Date.UTC(statementYear - 1, month - 1, day, 12, 0, 0, 0));
  }
  return candidates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
};

const parseSpanishCalendarDate = (
  dayStr: string,
  monthName: string,
  yearStr: string,
): Date | null => {
  const day = Number.parseInt(dayStr, 10);
  const year = Number.parseInt(yearStr, 10);
  const month = MONTHS_ES[normalizeMonthToken(monthName)];
  if (!Number.isFinite(day) || !Number.isFinite(year) || month === undefined) {
    return null;
  }
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
};

export type MercadoPagoParsedMovement = {
  rawLine: string;
  day: number;
  month: number;
  description: string;
  amount: number;
  paymentDate: Date;
  /** Cuotas: «N de M» en la descripción del PDF */
  installmentCurrent?: number;
  installmentTotal?: number;
};

export type MercadoPagoStatementParseResult = {
  accountNumber: string | null;
  statementIssueDate: Date | null;
  statementYear: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  totalDue: number | null;
  movements: MercadoPagoParsedMovement[];
  warnings: string[];
};

const isPurchaseOrWithdrawalLine = (description: string): boolean => {
  const d = description.trim();
  /** PDFs may use «Compra en …», «Compra internacional …», or «Compra …» sin «en». */
  if (/^compra\b/i.test(d)) return true;
  if (/^retiro\b/i.test(d)) return true;
  return false;
};

const shouldSkipMovementDescription = (description: string): boolean => {
  const d = description.trim().toLowerCase();
  if (d.includes('uso de la tarjeta de crédito')) return true;
  if (d.startsWith('subtotal')) return true;
  return false;
};

/**
 * Parse full PDF text (all pages concatenated by unpdf).
 */
export const parseMercadoPagoStatementText = (
  fullText: string,
): MercadoPagoStatementParseResult => {
  const warnings: string[] = [];
  const text = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!/mercado\s*pago/i.test(text) && !/MERCADO\s*PAGO/i.test(text)) {
    warnings.push(
      'El PDF no contiene referencias típicas a Mercado Pago; la extracción puede fallar.',
    );
  }

  const accountMatch = text.match(/Número de cuenta:\s*(\d+)/);
  const accountNumber = accountMatch?.[1] ?? null;

  const issueMatch =
    text.match(/Fecha:\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i) ??
    text.match(/Fecha\s+de\s+emisi[oó]n:?\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i) ??
    text.match(/Fecha\s+del\s+estado:?\s*(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  const statementIssueDate = issueMatch
    ? parseSpanishCalendarDate(issueMatch[1], issueMatch[2], issueMatch[3])
    : null;
  let statementYear = statementIssueDate?.getUTCFullYear() ?? null;

  let periodMatch = text.match(
    /Per[ií]odo\s*\n\s*(\d{1,2})\s+(\w+)\s*-\s*(\d{1,2})\s+(\w+)/i,
  );
  if (!periodMatch) {
    periodMatch = text.match(
      /Per[ií]odo\s+(\d{1,2})\s+(\w+)\s*-\s*(\d{1,2})\s+(\w+)/i,
    );
  }
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (periodMatch) {
    const d1 = Number.parseInt(periodMatch[1], 10);
    const m1n = MONTHS_ES[normalizeMonthToken(periodMatch[2])];
    const d2 = Number.parseInt(periodMatch[3], 10);
    const m2n = MONTHS_ES[normalizeMonthToken(periodMatch[4])];
    if (
      Number.isFinite(d1) &&
      Number.isFinite(d2) &&
      m1n !== undefined &&
      m2n !== undefined
    ) {
      let year = statementYear;
      if (year == null) {
        const yFromHeader = text.match(
          /(?:Fecha|emis[ií]on|Generad[oa]|estado)\b[^\d\n]{0,120}(20\d{2})/i,
        );
        year = yFromHeader ? Number.parseInt(yFromHeader[1], 10) : null;
      }
      if (year == null) {
        const yLoose = text.match(/\b(20[2-9]\d)\b/);
        year = yLoose ? Number.parseInt(yLoose[1], 10) : new Date().getUTCFullYear();
        warnings.push(
          'No se encontró la fecha del estado de cuenta; se usó un año inferido del PDF para el periodo.',
        );
      }
      statementYear = year;
      periodStart = new Date(Date.UTC(year, m1n, d1, 12, 0, 0, 0));
      periodEnd = new Date(Date.UTC(year, m2n, d2, 12, 0, 0, 0));
      if (periodEnd.getTime() < periodStart.getTime()) {
        periodEnd = new Date(Date.UTC(year + 1, m2n, d2, 12, 0, 0, 0));
        warnings.push(
          'El periodo cruza año civil; se ajustó la fecha de fin al año siguiente.',
        );
      }
    }
  }

  if (periodEnd == null && statementYear != null) {
    const cutMatch =
      text.match(/Fecha de corte\s*\n\s*(\d{1,2})\s+(\w+)/i) ??
      text.match(/Fecha de corte:?\s*(\d{1,2})\s+(\w+)/i);
    if (cutMatch) {
      const d = Number.parseInt(cutMatch[1], 10);
      const mn = MONTHS_ES[normalizeMonthToken(cutMatch[2])];
      if (Number.isFinite(d) && mn !== undefined) {
        periodEnd = new Date(Date.UTC(statementYear, mn, d, 12, 0, 0, 0));
        periodStart = addDaysUtc(periodEnd, -27);
        warnings.push(
          'No se encontró la línea de periodo; se estimó a partir de la fecha de corte.',
        );
      }
    }
  }

  const totalMatch =
    text.match(/Total a pagar del periodo\s*\$\s*([\d,]+\.\d{2})/i) ??
    text.match(/Total a pagar\s*\$\s*([\d,]+\.\d{2})/i);
  const totalDue = totalMatch
    ? Number.parseFloat(totalMatch[1].replace(/,/g, ''))
    : null;

  if (statementYear == null && periodEnd != null) {
    statementYear = periodEnd.getUTCFullYear();
  }

  const findMovimientosSliceStart = (t: string): number => {
    const candidates: RegExp[] = [
      /\n\s*Movimientos\s*\n/i,
      /\n\s*Movimientos\s+MXN/i,
      /\n\s*Movimientos\s+\$/i,
      /(?:^|\n)\s*Movimientos\s*\n/i,
      /\n\s*Movimientos\b/i,
    ];
    for (const re of candidates) {
      const ix = t.search(re);
      if (ix >= 0) return ix;
    }
    return -1;
  };

  const movIdx = findMovimientosSliceStart(text);
  if (movIdx < 0) {
    warnings.push('No se encontró la sección «Movimientos» en el PDF.');
    return {
      accountNumber,
      statementIssueDate,
      statementYear,
      periodStart,
      periodEnd,
      totalDue,
      movements: [],
      warnings,
    };
  }

  const fromMov = text.slice(movIdx);
  const lines = fromMov.split('\n').map((l) => l.trim());
  const movementLines: string[] = [];
  let i = 0;
  if (/^movimientos\b/i.test(lines[i] ?? '')) i += 1;
  if (/^mxn\s*\$?\s*$/i.test(lines[i] ?? '')) i += 1;

  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.startsWith('--')) continue;
    if (/^subtotal\b/i.test(line)) break;
    if (/^total\s+a\s+pagar\b/i.test(line)) break;
    if (/^resumen\s+de\s+movimientos\b/i.test(line)) break;
    movementLines.push(line);
  }

  const movements: MercadoPagoParsedMovement[] = [];
  const lineRe = /^(\d{1,2})\/(\d{1,2})\s+(.+)$/;

  if (periodEnd == null || statementYear == null) {
    warnings.push(
      'Faltan fecha de periodo o año del estado de cuenta; no se pueden resolver fechas de compra.',
    );
  }

  for (const rawLine of movementLines) {
    const m = rawLine.match(lineRe);
    if (!m) {
      warnings.push(`Línea ignorada (formato no reconocido): ${rawLine.slice(0, 80)}`);
      continue;
    }
    const day = Number.parseInt(m[1], 10);
    const month = Number.parseInt(m[2], 10);
    const description = m[3].trim();
    if (shouldSkipMovementDescription(description)) {
      continue;
    }
    if (!isPurchaseOrWithdrawalLine(description)) {
      continue;
    }
    const amount = parseMoneyAtEnd(rawLine);
    if (amount == null || amount <= 0) {
      warnings.push(`Monto no válido en: ${rawLine.slice(0, 80)}`);
      continue;
    }
    if (periodEnd == null || statementYear == null) {
      continue;
    }
    const paymentDate = pickTransactionDate(day, month, periodEnd, statementYear);
    const installmentParsed = parseInstallmentFromDescription(description);
    movements.push({
      rawLine,
      day,
      month,
      description,
      amount,
      paymentDate,
      ...(installmentParsed
        ? { installmentCurrent: installmentParsed.current, installmentTotal: installmentParsed.total }
        : {}),
    });
  }

  return {
    accountNumber,
    statementIssueDate,
    statementYear,
    periodStart,
    periodEnd,
    totalDue,
    movements,
    warnings,
  };
};

export const extractMercadoPagoStatementText = async (
  buffer: Buffer,
): Promise<string> => {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  /**
   * Per-page text (mergePages:false) keeps line breaks closer to the PDF layout.
   * mergePages:true collapses whitespace and often breaks «Movimientos» / DD/MM rows.
   */
  const result = await extractText(pdf, { mergePages: false });
  if (Array.isArray(result.text)) {
    return result.text.join('\n');
  }
  return result.text ?? '';
};
