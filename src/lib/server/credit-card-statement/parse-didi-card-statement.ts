/**
 * Parser for DiDi Card PDF statements.
 * Expects text extracted via unpdf.
 */

const MONTHS_DIDI: Record<string, number> = {
  ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5,
  JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11,
};

const parseDidiDateStr = (value: string): Date | null => {
  const match = value
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2})\s+([A-Z]{3})\.?\s+(\d{4})$/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = MONTHS_DIDI[match[2]];
  const year = Number.parseInt(match[3], 10);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) {
    return null;
  }
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
};

const parseMoneyAmount = (raw: string): number | null => {
  const normalized = raw.replace(/[,\s]/g, '');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
};

/**
 * DiDi occasionally renders installment marker + amount as `2 658.00` where:
 * - `2` = installment number (not part of amount)
 * - `658.00` = real charge amount
 *
 * We keep regular amounts untouched and only trim this specific shape.
 */
const normalizeTrailingMovementAmount = (raw: string): string => {
  const compact = raw.trim().replace(/\s+/g, ' ');
  const parts = compact.split(' ');
  if (parts.length !== 2) return compact;

  const [head, tail] = parts;
  const hasInstallmentMarker = /^\d{1,2}$/.test(head);
  const hasAmountTail = /^\d{3}\.\d{2}$/.test(tail);
  if (!hasInstallmentMarker || !hasAmountTail) return compact;

  return tail;
};

export type DidiCardParsedMovement = {
  rawLine: string;
  description: string;
  amount: number;
  paymentDate: Date;
};

export type DidiCardStatementParseResult = {
  accountNumber: string | null;
  statementIssueDate: Date | null;
  paymentDueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  totalDue: number | null;
  minimumPayment: number | null;
  currentBalance: number | null;
  /** Límite temporal promocional (MXN), si aparece en el PDF por encima de la línea normal. */
  temporaryCreditLimit: number | null;
  movements: DidiCardParsedMovement[];
  warnings: string[];
};

/** Single movement row: DD-MM-YYYY, last4, merchant, amount (possibly `2 658.00`). */
const tryParseDidiMovementLine = (rawLine: string): DidiCardParsedMovement | null => {
  const line = rawLine.trim();
  const headerMatch = line.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{4})\s+/);
  if (!headerMatch) return null;

  const tail = line.slice(headerMatch[0].length);
  const amountMatch = tail.match(/\s+(-?[\d,\s]+\.\d{2})$/);
  if (!amountMatch) return null;

  const amountRaw = amountMatch[1];
  const amount = parseMoneyAmount(normalizeTrailingMovementAmount(amountRaw));
  if (!amount || amount <= 0) return null;

  const description = tail.slice(0, tail.length - amountMatch[0].length).trim();
  if (!description) return null;

  const day = Number.parseInt(headerMatch[1], 10);
  const month = Number.parseInt(headerMatch[2], 10);
  const year = Number.parseInt(headerMatch[3], 10);
  const paymentDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  return {
    rawLine: line,
    description: description.replace(/\s+/g, ' ').trim(),
    amount,
    paymentDate,
  };
};

const MOVEMENT_ROW_HEAD = /\d{2}-\d{2}-\d{4}\s+\d{4}\s+/g;

const extractMovementsFromSectionBody = (sectionBody: string): DidiCardParsedMovement[] => {
  const movements: DidiCardParsedMovement[] = [];

  const lines = sectionBody
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  /**
   * One PDF text line can contain several movements (unpdf mergePages or tight layout).
   * Split on the next DD-MM-YYYY + last-4 pattern before parsing so amounts stay paired.
   */
  for (const line of lines) {
    MOVEMENT_ROW_HEAD.lastIndex = 0;
    const headerHits = [...line.matchAll(MOVEMENT_ROW_HEAD)];
    if (headerHits.length === 0) continue;

    const chunks =
      headerHits.length > 1
        ? line.split(/(?=\d{2}-\d{2}-\d{4}\s+\d{4}\s+)/).map((c) => c.trim()).filter(Boolean)
        : [line];

    for (const chunk of chunks) {
      const parsed = tryParseDidiMovementLine(chunk);
      if (parsed) movements.push(parsed);
    }
  }

  return movements;
};

export const parseDidiCardStatementText = (
  fullText: string,
): DidiCardStatementParseResult => {
  const warnings: string[] = [];
  const text = fullText.replace(/\r\n/g, '\n');

  if (!/Estado de cuenta de/i.test(text) || !/DiDi Card/i.test(text)) {
    warnings.push('El PDF no parece ser un estado de cuenta de DiDi Card.');
  }

  const contractMatch = text.match(/N[uú]mero de contrato:\s*(\d{8,20})/i);
  const accountNumber = contractMatch?.[1] ?? null;

  const cutDateMatch = text.match(/Fecha de corte:\s*(\d{1,2}\s+[A-Z]{3}\.\s+\d{4})/i);
  const statementIssueDate = cutDateMatch ? parseDidiDateStr(cutDateMatch[1]) : null;

  const dueDateMatch = text.match(
    /Fecha l[ií]mite de pago:\s*(\d{1,2}\s+[A-Z]{3}\.\s+\d{4})/i,
  );
  const paymentDueDate = dueDateMatch ? parseDidiDateStr(dueDateMatch[1]) : null;

  const periodMatch = text.match(
    /Periodo:\s*(\d{1,2}\s+[A-Z]{3}\.\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Z]{3}\.\s+\d{4})/i,
  );
  const periodStart = periodMatch ? parseDidiDateStr(periodMatch[1]) : null;
  const periodEnd = periodMatch ? parseDidiDateStr(periodMatch[2]) : null;

  const totalDueMatch = text.match(/Saldo total del periodo\s*MXN\$\s*([\d,\s]+\.\d{2})/i);
  const totalDue = totalDueMatch ? parseMoneyAmount(totalDueMatch[1]) : null;

  const minimumPaymentMatch = text.match(/Pago m[ií]nimo:\s*MXN\$\s*([\d,\s]+\.\d{2})/i);
  const minimumPayment = minimumPaymentMatch
    ? parseMoneyAmount(minimumPaymentMatch[1])
    : null;

  let temporaryCreditLimit: number | null = null;
  const tempBeforeLabel = text.match(/MXN\$\s*([\d,\s]+\.\d{2})\s*L[ií]mite temporal/i);
  if (tempBeforeLabel) {
    temporaryCreditLimit = parseMoneyAmount(tempBeforeLabel[1]);
  }
  if (temporaryCreditLimit == null) {
    const tempAfterLabel = text.match(/L[ií]mite temporal:?\s*MXN\$\s*([\d,\s]+\.\d{2})/i);
    if (tempAfterLabel) temporaryCreditLimit = parseMoneyAmount(tempAfterLabel[1]);
  }

  const movementsSectionMatch = text.match(
    /Compras y retiros de efectivo \(\+\)[\s\S]*?Unidades:\s*MXN\$\s*[\d,\s]+\.\d{2}([\s\S]*?)Intereses y comisiones \(\+\)/i,
  );

  if (!movementsSectionMatch) {
    warnings.push('No se encontró la sección de compras y retiros en el PDF.');
    return {
      accountNumber,
      statementIssueDate,
      paymentDueDate,
      periodStart,
      periodEnd,
      totalDue,
      minimumPayment,
      currentBalance: null,
      temporaryCreditLimit,
      movements: [],
      warnings,
    };
  }

  const movements = extractMovementsFromSectionBody(movementsSectionMatch[1]);

  return {
    accountNumber,
    statementIssueDate,
    paymentDueDate,
    periodStart,
    periodEnd,
    totalDue,
    minimumPayment,
    currentBalance: null,
    temporaryCreditLimit,
    movements,
    warnings,
  };
};

export const extractDidiCardStatementText = async (buffer: Buffer): Promise<string> => {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  /**
   * unpdf with mergePages:true replaces ALL whitespace (including newlines) with a single
   * space, which destroys DiDi movement rows. Per-page text keeps line breaks from the PDF.
   */
  const result = await extractText(pdf, { mergePages: false });
  if (Array.isArray(result.text)) {
    return result.text.join('\n');
  }
  return result.text ?? '';
};
