/**
 * Parser for Liverpool (Suburbia / Liverpool Visa) PDF credit card statements.
 * PDF text is obfuscated via Type3 fonts; use extractLiverpoolStatementText (operator list).
 */

import '@/lib/polyfills';
import {
  decodeLiverpoolAmountToken,
  decodeLiverpoolNumericToken,
  decodeLiverpoolPdfChar,
  LIVERPOOL_FONT_ENCODING_MAP,
} from '@/lib/server/credit-card-statement/liverpool-statement-encoding';

const MONTHS_LIVERPOOL: Record<string, number> = {
  ENE: 0,
  FEB: 1,
  MAR: 2,
  ABR: 3,
  MAY: 4,
  JUN: 5,
  QUN: 5,
  JUL: 6,
  AGO: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DIC: 11,
};

const parseLiverpoolMonth = (token: string): number | undefined => {
  const key = token.trim().toUpperCase();
  return MONTHS_LIVERPOOL[key];
};

const parseLiverpoolDateParts = (
  dayToken: string,
  monthToken: string,
  yearToken: string,
): Date | null => {
  const day = Number.parseInt(decodeLiverpoolNumericToken(dayToken), 10);
  const month = parseLiverpoolMonth(monthToken);
  const year = Number.parseInt(decodeLiverpoolNumericToken(yearToken), 10);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) {
    return null;
  }
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
};

const parseLiverpoolDateFromMatch = (
  match: RegExpMatchArray,
): Date | null => {
  return parseLiverpoolDateParts(match[1], match[2], match[3]);
};

const formatLiverpoolAccountNumber = (raw: string): string | null => {
  const digits = decodeLiverpoolNumericToken(raw.replace(/[`\\]/g, ''));
  if (digits.length < 10) return digits || null;
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  return digits;
};

const inferMovementYear = (movMonth: number, periodEnd: Date): number => {
  const periodEndMonth = periodEnd.getUTCMonth();
  const periodEndYear = periodEnd.getUTCFullYear();
  return movMonth > periodEndMonth ? periodEndYear - 1 : periodEndYear;
};

const buildMovementDate = (
  dayToken: string,
  monthToken: string,
  periodEnd: Date | null,
): Date | null => {
  const day = Number.parseInt(decodeLiverpoolNumericToken(dayToken), 10);
  const month = parseLiverpoolMonth(monthToken);
  if (!Number.isFinite(day) || month === undefined) return null;

  const year = periodEnd
    ? inferMovementYear(month, periodEnd)
  : new Date().getUTCFullYear();

  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
};

const isPaymentDescription = (description: string): boolean => {
  const upper = description.toUpperCase();
  return (
    upper.includes('GRACIA') ||
    upper.includes('POR SU PAGO') ||
    upper.includes('POR B') ||
    upper.includes('PAGO RECIBIDO') ||
    upper.includes('ABONO') ||
    upper.includes('DEVOLUCION')
  );
};

const isInstallmentPlanRow = (description: string): boolean => {
  const upper = description.toUpperCase();
  return (
    upper.includes('INTERE') ||
    upper.includes('MENSUAL') ||
    upper.includes('PLAN') ||
    upper.includes('MSI') ||
    upper.includes('MENB')
  );
};

export type LiverpoolParsedMovement = {
  rawLine: string;
  description: string;
  amount: number;
  paymentDate: Date;
};

export type LiverpoolStatementParseResult = {
  accountNumber: string | null;
  statementIssueDate: Date | null;
  paymentDueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  totalDue: number | null;
  minimumPayment: number | null;
  currentBalance: number | null;
  movements: LiverpoolParsedMovement[];
  warnings: string[];
};

const findLiverpoolDateAfterLabel = (
  text: string,
  labelPattern: RegExp,
): Date | null => {
  const labelMatch = text.match(labelPattern);
  if (labelMatch?.index == null) return null;
  const slice = text.slice(
    labelMatch.index + labelMatch[0].length,
    labelMatch.index + labelMatch[0].length + 40,
  );
  const dateMatch = slice.match(/^([0-9pk]+)`([A-Z]{3})`([0-9pk]+)/i);
  if (!dateMatch) return null;
  return parseLiverpoolDateFromMatch(dateMatch);
};

const findLiverpoolAmountAfterLabel = (
  text: string,
  labelPattern: RegExp,
): number | null => {
  const labelMatch = text.match(labelPattern);
  if (labelMatch?.index == null) return null;
  const slice = text.slice(
    labelMatch.index + labelMatch[0].length,
    labelMatch.index + labelMatch[0].length + 40,
  );
  const amountMatch = slice.match(/([`\\]?[\d.pkK]+)/);
  if (!amountMatch) return null;
  return decodeLiverpoolAmountToken(amountMatch[1]);
};

const extractMovements = (
  text: string,
  periodEnd: Date | null,
): LiverpoolParsedMovement[] => {
  const sectionMatch = text.match(
    /DETALLE DE MOVIMIENTO[Sb][\s\S]*?(?:RE[Sb]UMEN DE PLANES|IMPORTANTE|$)/i,
  );
  if (!sectionMatch) return [];

  const body = sectionMatch[0].split(/RE[Sb]UMEN DE PLANES/i)[0] ?? sectionMatch[0];
  const periodHeaderEnd = body.search(/AL\s+[0-9pk]+`[A-Z]{3}`[0-9pk]+/i);
  const movementBody =
    periodHeaderEnd === -1
      ? body
      : body.slice(periodHeaderEnd).replace(/^AL\s+[0-9pk]+`[A-Z]{3}`[0-9pk]+/i, '');
  const movements: LiverpoolParsedMovement[] = [];
  const heads = [...movementBody.matchAll(/([0-9]+p?)`([A-Z]{3})/g)];

  for (let i = 0; i < heads.length; i++) {
    const head = heads[i];
    if (head.index == null) continue;

    const dayToken = head[1];
    const monthToken = head[2];
    const segmentStart = head.index + head[0].length;
    const segmentEnd = heads[i + 1]?.index ?? movementBody.length;
    const segment = movementBody.slice(segmentStart, segmentEnd).trim();

    const amountMatch = segment.match(/([`\\]?[\d.pkK]{4,})$/);
    if (!amountMatch) continue;

    const amountToken = amountMatch[1];
    const description = segment.slice(0, segment.length - amountMatch[0].length).trim();

    if (!description || isPaymentDescription(description) || isInstallmentPlanRow(description)) {
      continue;
    }

    if (amountToken.startsWith('`')) continue;

    const amount = decodeLiverpoolAmountToken(amountToken);
    if (amount == null || amount <= 0) continue;

    const paymentDate = buildMovementDate(dayToken, monthToken, periodEnd);
    if (!paymentDate) continue;

    movements.push({
      rawLine: `${dayToken}\`${monthToken}\`${segment}`,
      description: description.replace(/\s+/g, ' ').trim(),
      amount,
      paymentDate,
    });
  }

  return movements;
};

export const parseLiverpoolStatementText = (
  fullText: string,
): LiverpoolStatementParseResult => {
  const warnings: string[] = [];
  const text = fullText.replace(/\r\n/g, '\n');

  if (!/CUENTA|DETALLE DE MOVIMIENTO|FECHA DE CORTE|CLABE/i.test(text)) {
    warnings.push('El PDF no parece ser un estado de cuenta de Liverpool.');
  }

  const accountRawMatch = text.match(
    /NOK\s+DE\s*CUENTA([0-9pk`\\]+)/i,
  );
  const accountNumber = accountRawMatch
    ? formatLiverpoolAccountNumber(accountRawMatch[1])
    : null;

  const paymentDueDate = findLiverpoolDateAfterLabel(
    text,
    /FECHA\s+L.{1,4}MITE\s+DE\s+PAGO/i,
  );
  const statementIssueDate = findLiverpoolDateAfterLabel(
    text,
    /FECHA\s+DE\s+CORTE/i,
  );

  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  const periodMatch = text.match(
    /DETALLE DE MOVIMIENTO[Sb][\s\S]*?DEL\s+([0-9pk]+)`([A-Z]{3})`([0-9pk]+)\s+AL\s+([0-9pk]+)`([A-Z]{3})`([0-9pk]+)/i,
  );
  if (periodMatch) {
    periodStart = parseLiverpoolDateParts(periodMatch[1], periodMatch[2], periodMatch[3]);
    periodEnd = parseLiverpoolDateParts(periodMatch[4], periodMatch[5], periodMatch[6]);
  }
  if (!periodEnd && statementIssueDate) {
    periodEnd = statementIssueDate;
    warnings.push(
      'No se encontró el período en movimientos; se usó la fecha de corte como fin de período.',
    );
  }

  const minimumPayment =
    findLiverpoolAmountAfterLabel(text, /PAGO\s+M[uU]?[IÍ]NIMO\s*/i) ??
    findLiverpoolAmountAfterLabel(text, /PAGO\s+M[uU]?NIMO\s*/i);

  const totalDue =
    findLiverpoolAmountAfterLabel(
      text,
      /PAGO\s+PARA\s+NO\s+GENERAR\s+INTER[EÉb][bE]?(?:SES|bEb)/i,
    ) ??
    findLiverpoolAmountAfterLabel(text, /bIN\s+INTER[EÉb][bE]?(?:SES|bEb)/i);

  const currentBalance = findLiverpoolAmountAfterLabel(
    text,
    /[sSb]?ALDO\s+ACTUAL\s+AL\s+CORTE\s*/i,
  );

  const movements = extractMovements(text, periodEnd);

  if (movements.length === 0) {
    warnings.push(
      'No se encontraron compras en el detalle de movimientos (solo pagos u otros abonos).',
    );
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

type PdfGlyph = { originalCharCode?: number };

export const extractLiverpoolStatementText = async (buffer: Buffer): Promise<string> => {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const ops = await page.getOperatorList();
    let current = '';

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn !== 44 && fn !== 40) continue;

      const glyphs = args?.[0] as PdfGlyph[] | undefined;
      if (!Array.isArray(glyphs)) continue;

      for (const glyph of glyphs) {
        const code = glyph.originalCharCode ?? 0;
        const ch = decodeLiverpoolPdfChar(code, LIVERPOOL_FONT_ENCODING_MAP);
        if (ch === '\n') {
          if (current.trim()) lines.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }

    if (current.trim()) lines.push(current.trim());
  }

  return lines.join('\n');
};

/** Exported for tests — decode a Liverpool date token triple. */
export const parseLiverpoolObfuscatedDate = (
  dayToken: string,
  monthToken: string,
  yearToken: string,
): Date | null => parseLiverpoolDateParts(dayToken, monthToken, yearToken);
