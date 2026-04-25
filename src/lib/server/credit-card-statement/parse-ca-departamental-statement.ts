/**
 * Parser for C&A Departamental (Tarjeta C&A Bradescard) PDF statements.
 * Expects text extracted via unpdf.
 */

const MONTHS_CA: Record<string, number> = {
  ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5,
  JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11,
};

/** Parse a C&A date string like "10/MAR/26" → Date (UTC noon). */
const parseCaDateStr = (s: string): Date | null => {
  const m = s.match(/^(\d{1,2})\/([A-Z]{3})\/(\d{2})$/i);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const month = MONTHS_CA[m[2].toUpperCase()];
  const year = 2000 + Number.parseInt(m[3], 10);
  if (month === undefined || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
};

/**
 * Infer the year for a DD/MM movement date from the statement period end.
 * If the movement month is after the period-end month, it belongs to the previous year.
 */
const inferMovementYear = (movMonth: number, periodEnd: Date): number => {
  const periodEndMonth = periodEnd.getUTCMonth() + 1; // 1–12
  const periodEndYear = periodEnd.getUTCFullYear();
  return movMonth > periodEndMonth ? periodEndYear - 1 : periodEndYear;
};

export type CaDepartamentalParsedMovement = {
  rawLines: string[];
  day: number;
  month: number;
  description: string;
  amount: number;
  paymentDate: Date;
  installmentCurrent?: number;
  installmentTotal?: number;
};

export type CaDepartamentalStatementParseResult = {
  accountNumber: string | null;
  statementIssueDate: Date | null;
  paymentDueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  totalDue: number | null;
  minimumPayment: number | null;
  /** Saldo Total from the statement header — used to sync wallet balance after import. */
  currentBalance: number | null;
  movements: CaDepartamentalParsedMovement[];
  warnings: string[];
};

export const parseCaDepartamentalStatementText = (
  fullText: string,
): CaDepartamentalStatementParseResult => {
  const warnings: string[] = [];
  const text = fullText.replace(/\r\n/g, '\n');

  if (!/TARJETA C&A BRADESCARD/i.test(text)) {
    warnings.push(
      'El PDF no parece ser un estado de cuenta de Tarjeta C&A Bradescard.',
    );
  }

  // Full card number from movements section header
  const cardMatch = text.match(/TARJETA TITULAR NO[.\s]*(\d{13,19})/i);
  const accountNumber = cardMatch?.[1] ?? null;

  // Cut date = statement issue date: "Fecha de Corte: 10/MAR/26"
  const cutMatch = text.match(/Fecha de Corte:\s*(\d{1,2}\/[A-Z]{3}\/\d{2})/i);
  const statementIssueDate = cutMatch ? parseCaDateStr(cutMatch[1]) : null;

  // Payment due date: "Fecha Límite de Pago: 03/ABR/26"
  const dueMatch = text.match(/Fecha L[ií]mite de Pago:\s*(\d{1,2}\/[A-Z]{3}\/\d{2})/i);
  const paymentDueDate = dueMatch ? parseCaDateStr(dueMatch[1]) : null;

  // Period: "PERÍODO: 11/FEB/26 - 10/MAR/26"
  const periodMatch = text.match(
    /PER[IÍ]ODO:\s*(\d{1,2}\/[A-Z]{3}\/\d{2})\s*-\s*(\d{1,2}\/[A-Z]{3}\/\d{2})/i,
  );
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (periodMatch) {
    periodStart = parseCaDateStr(periodMatch[1]);
    periodEnd = parseCaDateStr(periodMatch[2]);
  }
  if (!periodEnd && statementIssueDate) {
    periodEnd = statementIssueDate;
    warnings.push(
      'No se encontró el período; se usó la fecha de corte como fin de período.',
    );
  }

  // EN POCAS PALABRAS summary table — last column is "Total Del Mes".
  // Anchor on "Anterior" (column header word appearing just before the data row).
  let totalDue: number | null = null;
  let minimumPayment: number | null = null;
  const summaryRowMatch = text.match(
    /EN POCAS PALABRAS[\s\S]{0,800}?Anterior[\s\S]{0,100}?(?:\$\s*-?[\d,]+\.\d{2}\s+){3,}\$\s*([\d,]+\.\d{2})/i,
  );
  if (summaryRowMatch) {
    totalDue = Number.parseFloat(summaryRowMatch[1].replace(/,/g, ''));
  }

  // Minimum payment from the payment options box
  const payOptsMatch = text.match(
    /ELIGE 1 DE ESTAS OPCIONES[\s\S]{0,400}?\$\s*([\d,]+\.\d{2})\s+\$\s*([\d,]+\.\d{2})/i,
  );
  if (payOptsMatch) {
    minimumPayment = Number.parseFloat(payOptsMatch[2].replace(/,/g, ''));
    if (totalDue === null) {
      totalDue = Number.parseFloat(payOptsMatch[1].replace(/,/g, ''));
    }
  }

  // Saldo Total from the header table — authoritative current balance for the account.
  const saldoTotalMatch = text.match(/Saldo Total:\s*\$\s*([\d,]+\.\d{2})/i);
  const currentBalance = saldoTotalMatch
    ? Number.parseFloat(saldoTotalMatch[1].replace(/,/g, ''))
    : null;

  if (totalDue === null) {
    totalDue = currentBalance;
  }

  // Locate movements section: starts after "TARJETA TITULAR NO." line, ends at "TOTAL:$"
  const movSectionStartIdx = text.search(/TARJETA TITULAR NO[.\s]*\d/i);
  if (movSectionStartIdx < 0) {
    warnings.push('No se encontró la sección de movimientos en el PDF.');
    return {
      accountNumber,
      statementIssueDate,
      paymentDueDate,
      periodStart,
      periodEnd,
      totalDue,
      minimumPayment,
      currentBalance,
      movements: [],
      warnings,
    };
  }

  const movSectionEndIdx = text.indexOf('TOTAL:', movSectionStartIdx);
  const movSection =
    movSectionEndIdx > movSectionStartIdx
      ? text.slice(movSectionStartIdx, movSectionEndIdx)
      : text.slice(movSectionStartIdx);

  const lines = movSection
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Group lines into movement blocks: each block starts with a line matching DD/MM
  const startsWithDate = (l: string) => /^\d{2}\/\d{2}[\s]/.test(l);

  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (startsWithDate(line)) {
      if (current.length > 0) groups.push(current);
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  const movements: CaDepartamentalParsedMovement[] = [];

  for (const group of groups) {
    const firstLine = group[0];
    const dateMatch = firstLine.match(/^(\d{2})\/(\d{2})\s+(.*)/);
    if (!dateMatch) continue;

    const day = Number.parseInt(dateMatch[1], 10);
    const movMonth = Number.parseInt(dateMatch[2], 10);
    const restOfFirstLine = dateMatch[3];

    // Combined text used for filtering and amount extraction
    const combined = group.join(' ');

    // Only import COMPRA lines
    if (!/COMPRA\b/i.test(combined)) continue;

    // Extract cargo amount (positive)
    const amountMatch = combined.match(/\$\s*([\d,]+\.\d{2})/);
    if (!amountMatch) {
      warnings.push(`Monto no encontrado en: ${combined.slice(0, 80)}`);
      continue;
    }
    const amount = Number.parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (!periodEnd) {
      warnings.push(
        'No se puede resolver la fecha del movimiento sin fecha de fin de período.',
      );
      continue;
    }

    const year = inferMovementYear(movMonth, periodEnd);
    const paymentDate = new Date(Date.UTC(year, movMonth - 1, day, 12, 0, 0, 0));

    // Parse installment reference from continuation lines, e.g. "05/06"
    let installmentCurrent: number | undefined;
    let installmentTotal: number | undefined;
    for (let i = 1; i < group.length; i++) {
      const contLine = group[i];
      if (!contLine.includes('$')) {
        const installmentMatch = contLine.match(/\b(\d{1,2})\/(\d{2})\b/);
        if (installmentMatch) {
          installmentCurrent = Number.parseInt(installmentMatch[1], 10);
          installmentTotal = Number.parseInt(installmentMatch[2], 10);
          break;
        }
      }
    }

    // Reconstruct description: strip amount and installment reference
    const stripAmount = (s: string) => s.replace(/\$\s*[\d,]+\.\d{2}/, '');
    const stripInstallment = (s: string) => s.replace(/\b\d{1,2}\/\d{2}\b/, '');

    const descParts = group.map((l, i) => {
      const base = i === 0 ? stripAmount(restOfFirstLine) : stripAmount(stripInstallment(l));
      return base.trim();
    });
    const description = descParts
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    movements.push({
      rawLines: group,
      day,
      month: movMonth,
      description,
      amount,
      paymentDate,
      ...(installmentCurrent !== undefined && installmentTotal !== undefined
        ? { installmentCurrent, installmentTotal }
        : {}),
    });
  }

  return {
    accountNumber,
    statementIssueDate,
    paymentDueDate,
    periodStart,
    periodEnd,
    totalDue,
    minimumPayment,
    currentBalance,
    movements,
    warnings,
  };
};

export const extractCaDepartamentalStatementText = async (
  buffer: Buffer,
): Promise<string> => {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  return (Array.isArray(result.text) ? result.text.join('\n') : result.text) ?? '';
};
