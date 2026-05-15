import '@/lib/polyfills';

export type ParsedReceiptLine = {
  description: string;
  quantity: number;
  unit_label: string | null;
  unit_price: number | null;
  line_total: number;
};

export type ParsedReceiptDebugEvent = {
  phase: 'extract' | 'profile' | 'classify' | 'parse' | 'validate';
  message: string;
  line?: string;
  profile?: string;
};

export type ParsedReceipt = {
  title: string | null;
  merchant_ref: string | null;
  purchased_at: Date | null;
  subtotal: number | null;
  discount_total: number | null;
  delivery_fee: number | null;
  grand_total: number | null;
  lines: ParsedReceiptLine[];
  warnings: string[];
  debug_trace?: ParsedReceiptDebugEvent[];
};

type ReceiptTextCell = {
  text: string;
  x?: number;
  width?: number;
};

type ReceiptTextRow = {
  text: string;
  cells: ReceiptTextCell[];
  page?: number;
  y?: number;
};

type ReceiptSummaryKey =
  | 'subtotal'
  | 'discount_total'
  | 'delivery_fee'
  | 'grand_total';

type ReceiptFormatProfile = {
  id: string;
  name: string;
  detect: (allText: string) => boolean;
  noisePatterns: RegExp[];
  summaryPatterns: Array<{ key: ReceiptSummaryKey; pattern: RegExp }>;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export const PANTRY_RECEIPT_MAX_FILE_BYTES = MAX_FILE_BYTES;

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

/**
 * Parse a money-like token tolerating both `1,234.56` (US/MX) and `1.234,56` (EU/ES) formats.
 * Decides which separator is decimal by looking at the rightmost group: if a `,` or `.`
 * is followed by 1–2 digits at the end of the token, that's the decimal separator and the
 * other separator is treated as thousands. If both appear, the rightmost wins.
 */
const parseMoneyToken = (token: string): number | null => {
  let s = token.replace(/[$\s]/g, '');
  const isNegative = s.startsWith('-');
  if (isNegative) s = s.slice(1);
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decimalSep: '.' | ',' | null = null;
  if (lastComma === -1 && lastDot === -1) {
    decimalSep = null;
  } else if (lastComma === -1) {
    decimalSep = /\.\d{1,2}$/.test(s) ? '.' : null;
  } else if (lastDot === -1) {
    decimalSep = /,\d{1,2}$/.test(s) ? ',' : null;
  } else {
    decimalSep = lastComma > lastDot ? ',' : '.';
  }

  let normalized: string;
  if (decimalSep === ',') {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (decimalSep === '.') {
    normalized = s.replace(/,/g, '');
  } else {
    normalized = s.replace(/[.,]/g, '');
  }

  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return isNegative ? -n : n;
};

const MONEY_TOKEN_RE = /\$?\s*-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\$?\s*-?\d+(?:[.,]\d{1,2})?/g;
const MONEY_AT_END_RE = /\$?\s*-?\d[\d.,]*(?:[.,]\d{1,2})?\s*$/;

const extractLastMoneyOnLine = (line: string): number | null => {
  let last: number | null = null;
  let m: RegExpExecArray | null;
  MONEY_TOKEN_RE.lastIndex = 0;
  while ((m = MONEY_TOKEN_RE.exec(line)) !== null) {
    const tok = m[0].trim();
    if (!tok || !/\d/.test(tok)) continue;
    if (!tok.includes('$') && !/[.,]\d{1,2}$/.test(tok)) continue;
    const v = parseMoneyToken(tok);
    if (v != null) last = v;
  }
  return last;
};

const parsePedidoDate = (line: string): Date | null => {
  const m = line.match(
    /Pedido\s+el\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i,
  );
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const month = MONTHS_ES[monthName];
  if (!Number.isFinite(day) || month === undefined) return null;
  const year = new Date().getFullYear();
  const d = new Date(year, month, day, 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
};

const QTY_UNIT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|pz|g|ml|l|lt|pieza|piezas|unidad|unidades|paq|paquete)\b/i;

const PRINTED_PAGE_FOOTER_RE =
  /^\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm)?\b/i;

const isReceiptNoiseLine = (line: string): boolean =>
  PRINTED_PAGE_FOOTER_RE.test(line) ||
  /^\d+\s*\/\s*\d+$/.test(line) ||
  /^Detalles del pedido\b/i.test(line) ||
  /Detalles del pedido\s*-\s*BodegaAurrera\.com\.mx/i.test(line);

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const roundQuantity = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  return Math.round(value * 10_000) / 10_000;
};

const createEmptyReceipt = (): ParsedReceipt => ({
  title: null,
  merchant_ref: null,
  purchased_at: null,
  subtotal: null,
  discount_total: null,
  delivery_fee: null,
  grand_total: null,
  lines: [],
  warnings: [],
  debug_trace:
    process.env.NODE_ENV !== 'production' || process.env.PANTRY_RECEIPT_DEBUG === '1'
      ? []
      : undefined,
});

const trace = (
  receipt: ParsedReceipt,
  event: ParsedReceiptDebugEvent,
): void => {
  receipt.debug_trace?.push(event);
};

const parseQuantityCell = (cell: string): { quantity: number; unit_label: string | null } | null => {
  const m = cell.match(QTY_UNIT_RE);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return { quantity: roundQuantity(n), unit_label: m[2].toLowerCase() };
};

const RECEIPT_PROFILES: ReceiptFormatProfile[] = [
  {
    id: 'bodega_aurrera',
    name: 'Bodega Aurrera',
    detect: (text) => /bodega\s*aurrera|bodegaaurrera\.com\.mx/i.test(text),
    noisePatterns: [
      /^Código de barras/i,
      /Detalles del pedido\s*-\s*BodegaAurrera\.com\.mx/i,
      /^Método$/i,
      /^de$/i,
      /^pago$/i,
    ],
    summaryPatterns: [
      { key: 'subtotal', pattern: /^Subtotal\b/i },
      { key: 'discount_total', pattern: /^Descuento\b(?!.*envío)/i },
      { key: 'delivery_fee', pattern: /^Costo de entrega\b/i },
      { key: 'grand_total', pattern: /^Total\b/i },
    ],
  },
  {
    id: 'walmart',
    name: 'Walmart',
    detect: (text) => /walmart/i.test(text),
    noisePatterns: [/^Código de barras/i, /^Método$/i, /^Pago$/i],
    summaryPatterns: [
      { key: 'subtotal', pattern: /^Subtotal\b/i },
      { key: 'discount_total', pattern: /^Descuento\b/i },
      { key: 'delivery_fee', pattern: /^(Costo de entrega|Envío)\b/i },
      { key: 'grand_total', pattern: /^Total\b/i },
    ],
  },
  {
    id: 'soriana',
    name: 'Soriana',
    detect: (text) => /soriana/i.test(text),
    noisePatterns: [/^Ticket\b/i, /^Gracias por su compra/i],
    summaryPatterns: [
      { key: 'subtotal', pattern: /^Subtotal\b/i },
      { key: 'discount_total', pattern: /^(Descuento|Ahorro)\b/i },
      { key: 'delivery_fee', pattern: /^(Envío|Entrega)\b/i },
      { key: 'grand_total', pattern: /^Total\b/i },
    ],
  },
  {
    id: 'chedraui',
    name: 'Chedraui',
    detect: (text) => /chedraui/i.test(text),
    noisePatterns: [/^Ticket\b/i, /^Gracias por su compra/i],
    summaryPatterns: [
      { key: 'subtotal', pattern: /^Subtotal\b/i },
      { key: 'discount_total', pattern: /^(Descuento|Ahorro)\b/i },
      { key: 'delivery_fee', pattern: /^(Envío|Entrega)\b/i },
      { key: 'grand_total', pattern: /^Total\b/i },
    ],
  },
  {
    id: 'generic',
    name: 'Genérico',
    detect: () => true,
    noisePatterns: [],
    summaryPatterns: [
      { key: 'subtotal', pattern: /^Subtotal\b/i },
      { key: 'discount_total', pattern: /^Descuento\b/i },
      { key: 'delivery_fee', pattern: /^(Costo de entrega|Envío|Entrega)\b/i },
      { key: 'grand_total', pattern: /^Total\b/i },
    ],
  },
];

const detectProfile = (rows: ReceiptTextRow[]): ReceiptFormatProfile => {
  const allText = rows.map((row) => row.text).join('\n');
  return RECEIPT_PROFILES.find((profile) => profile.detect(allText)) ?? RECEIPT_PROFILES.at(-1)!;
};

const rowsFromPlainText = (raw: string): ReceiptTextRow[] =>
  raw.split(/\r?\n/).map((line) => {
    const cells = line
      .split('\t')
      .map((text) => ({ text: text.trim() }))
      .filter((cell) => cell.text.length > 0);
    return {
      text: line.trim(),
      cells,
    };
  });

const rowText = (row: ReceiptTextRow): string =>
  row.cells.length > 0 ? row.cells.map((cell) => cell.text).join('\t') : row.text;

const isNoiseRow = (row: ReceiptTextRow, profile: ReceiptFormatProfile): boolean => {
  const line = rowText(row).trim();
  return (
    line.length === 0 ||
    /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line) ||
    line.startsWith('http://') ||
    line.startsWith('https://') ||
    isReceiptNoiseLine(line) ||
    profile.noisePatterns.some((pattern) => pattern.test(line))
  );
};

const classifySummaryRow = (
  row: ReceiptTextRow,
  profile: ReceiptFormatProfile,
): ReceiptSummaryKey | null => {
  const line = rowText(row).trim();
  return profile.summaryPatterns.find((entry) => entry.pattern.test(line))?.key ?? null;
};

/**
 * Parse a product row.
 *
 * Primary path: tab-separated cells reconstructed from PDF positions
 *   "<desc>\t<qty unit>\t$<total>"
 *
 * Tab-less fallback: when the PDF gave us a flat line we can still salvage
 *   "<desc> <qty> <unit> $<total>"   or   "<desc> $<total>"
 * by anchoring on the trailing money token.
 */
const parseProductLine = (line: string): ParsedReceiptLine | null => {
  if (!line.includes('$') && !QTY_UNIT_RE.test(line)) return null;

  const lineTotal = extractLastMoneyOnLine(line);
  if (lineTotal == null || lineTotal <= 0) return null;

  let desc = '';
  let qtyCell: string | null = null;

  if (line.includes('\t')) {
    const cells = line
      .split('\t')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    let totalCellIndex = -1;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (extractLastMoneyOnLine(cells[i]!) != null) {
        totalCellIndex = i;
        break;
      }
    }
    const headCells =
      totalCellIndex >= 0 ? cells.slice(0, totalCellIndex) : cells.slice(0, -1);
    let qtyIndex = -1;
    for (let i = headCells.length - 1; i >= 1; i--) {
      if (QTY_UNIT_RE.test(headCells[i]!)) {
        qtyIndex = i;
        break;
      }
    }
    if (qtyIndex >= 0) {
      qtyCell = headCells[qtyIndex]!;
      desc = headCells.slice(0, qtyIndex).join(' ').trim();
    } else {
      const dollarIdx = line.lastIndexOf('$');
      const head =
        dollarIdx >= 0 ? line.slice(0, dollarIdx) : line.replace(/[\d.,\s-]+$/, '');
      const fallbackCells = head
        .split('\t')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      desc = fallbackCells[0] ?? '';
      qtyCell = fallbackCells.length >= 2 ? fallbackCells[fallbackCells.length - 1]! : null;
    }
  } else {
    const moneyMatch = line.match(MONEY_AT_END_RE);
    const moneyStart = moneyMatch ? line.lastIndexOf(moneyMatch[0]) : -1;
    if (moneyStart < 0) return null;
    const head = line.slice(0, moneyStart).trimEnd();
    const qtyMatch = head.match(QTY_UNIT_RE);
    if (qtyMatch && qtyMatch.index !== undefined) {
      desc = head.slice(0, qtyMatch.index).trim();
      qtyCell = qtyMatch[0];
    } else {
      desc = head;
    }
  }

  if (desc.length < 2) return null;

  let quantity = 1;
  let unit_label: string | null = null;
  let unit_price: number | null = null;

  if (qtyCell) {
    const parsed = parseQuantityCell(qtyCell);
    if (parsed) {
      quantity = parsed.quantity;
      unit_label = parsed.unit_label;
      unit_price = roundMoney(lineTotal / quantity);
    }
  }

  return {
    description: desc,
    quantity: roundQuantity(quantity),
    unit_label,
    unit_price,
    line_total: lineTotal,
  };
};

const parseSummaryLine = (
  line: string,
  key: 'subtotal' | 'discount_total' | 'delivery_fee' | 'grand_total',
  target: ParsedReceipt,
): void => {
  const parts = line.split('\t');
  const last = parts[parts.length - 1]?.trim() ?? '';
  const amount =
    extractLastMoneyOnLine(last) ??
    parseMoneyToken(last) ??
    extractLastMoneyOnLine(line) ??
    parseMoneyToken(line);
  if (amount == null) return;
  if (key === 'discount_total' && (last.startsWith('-') || line.includes('-'))) {
    target.discount_total = Math.abs(amount);
    return;
  }
  target[key] = Math.abs(amount);
};

const validateReceiptTotals = (receipt: ParsedReceipt): void => {
  if (receipt.lines.length === 0) return;
  const linesSum = roundMoney(
    receipt.lines.reduce((acc, line) => acc + line.line_total, 0),
  );
  trace(receipt, {
    phase: 'validate',
    message: `line_sum=${linesSum}, subtotal=${receipt.subtotal ?? 'n/a'}, total=${receipt.grand_total ?? 'n/a'}`,
  });

  if (receipt.subtotal != null) {
    const diff = Math.abs(roundMoney(linesSum - receipt.subtotal));
    if (diff > 1) {
      receipt.warnings.push(
        `La suma de productos (${linesSum.toFixed(2)}) no coincide con el subtotal (${receipt.subtotal.toFixed(2)}). Revisa renglones omitidos o importes duplicados.`,
      );
    }
  }

  if (receipt.grand_total == null) return;
  const expectedTotal = roundMoney(
    linesSum - (receipt.discount_total ?? 0) + (receipt.delivery_fee ?? 0),
  );
  const totalDiff = Math.abs(roundMoney(expectedTotal - receipt.grand_total));
  if (totalDiff > 1) {
    receipt.warnings.push(
      `El total esperado con descuentos/envío (${expectedTotal.toFixed(2)}) difiere del total del recibo (${receipt.grand_total.toFixed(2)}).`,
    );
  }
};

/**
 * Parses plain text / PDF-extracted text from grocery receipts (e.g. Bodega Aurrera despensa PDFs).
 */
export const parsePantryReceiptText = (raw: string): ParsedReceipt => {
  return parsePantryReceiptRows(rowsFromPlainText(raw), raw.includes('\t'));
};

const parsePantryReceiptRows = (
  rows: ReceiptTextRow[],
  hasAnyTab: boolean,
): ParsedReceipt => {
  const result = createEmptyReceipt();
  const profile = detectProfile(rows);
  trace(result, {
    phase: 'profile',
    profile: profile.id,
    message: `Detected ${profile.name}`,
  });
  let descBuffer = '';

  const flushBuffer = () => {
    descBuffer = '';
  };

  for (const row of rows) {
    const line = rowText(row).trim();
    if (!line) {
      flushBuffer();
      continue;
    }

    if (isNoiseRow(row, profile)) {
      trace(result, { phase: 'classify', message: 'noise', line, profile: profile.id });
      flushBuffer();
      continue;
    }
    if (/Detalles del pedido/i.test(line) && line.includes('\t')) {
      const left = line.split('\t')[0] ?? '';
      if (/Detalles del pedido/i.test(left)) {
        result.title = left.replace(/\s+/g, ' ').trim();
      }
      flushBuffer();
      continue;
    }

    if (/^Pedido el\b/i.test(line)) {
      result.purchased_at = parsePedidoDate(line);
      flushBuffer();
      continue;
    }

    const pedidoHash = line.match(/^Pedido\s*#\s*([\w-]+)/i);
    if (pedidoHash) {
      result.merchant_ref = pedidoHash[1] ?? null;
      flushBuffer();
      continue;
    }

    if (/^Descuento en envío/i.test(line)) {
      flushBuffer();
      continue;
    }
    const summaryKey = classifySummaryRow(row, profile);
    if (summaryKey) {
      parseSummaryLine(line, summaryKey, result);
      trace(result, {
        phase: 'classify',
        message: `summary:${summaryKey}`,
        line,
        profile: profile.id,
      });
      flushBuffer();
      continue;
    }

    const candidate = descBuffer ? `${descBuffer} ${line}` : line;
    const product = parseProductLine(candidate);
    if (product) {
      result.lines.push(product);
      trace(result, {
        phase: 'parse',
        message: `product:${product.description}`,
        line: candidate,
        profile: profile.id,
      });
      flushBuffer();
      continue;
    }

    if (!/[\d.,]+/.test(line) || line.length < 40) {
      descBuffer = candidate;
      trace(result, { phase: 'classify', message: 'buffer', line, profile: profile.id });
    } else {
      trace(result, { phase: 'classify', message: 'discard', line, profile: profile.id });
      flushBuffer();
    }
  }

  if (result.lines.length === 0) {
    if (!hasAnyTab) {
      result.warnings.push(
        'La estructura del PDF no se reconoció (sin columnas detectables). Si es escaneado, prueba subir un CSV con columnas: descripcion, cantidad, total.',
      );
    } else {
      result.warnings.push(
        'No se detectaron productos en el archivo. Puedes agregar renglones manualmente o subir un CSV con columnas: descripcion, cantidad, total.',
      );
    }
  }

  validateReceiptTotals(result);
  return result;
};

const normalizeHeader = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const parseCsvToReceipt = (raw: string): ParsedReceipt => {
  const warnings: string[] = [];
  const stripped = raw.replace(/^﻿/, '');
  const rows = splitCsvRows(stripped);
  if (rows.length === 0) {
    return {
      title: null,
      merchant_ref: null,
      purchased_at: null,
      subtotal: null,
      discount_total: null,
      delivery_fee: null,
      grand_total: null,
      lines: [],
      warnings: ['CSV vacío.'],
    };
  }

  const headerCells = splitCsvLine(rows[0]).map(normalizeHeader);
  const descIdx = headerCells.findIndex((h) =>
    ['descripcion', 'producto', 'item', 'nombre'].includes(h),
  );
  const qtyIdx = headerCells.findIndex((h) =>
    ['cantidad', 'qty', 'quantity'].includes(h),
  );
  const totalIdx = headerCells.findIndex((h) =>
    ['total', 'importe', 'line_total', 'subtotal_linea'].includes(h),
  );
  const unitIdx = headerCells.findIndex((h) =>
    ['unidad', 'unit', 'unit_label', 'medida'].includes(h),
  );
  const unitPriceIdx = headerCells.findIndex((h) =>
    ['precio_unitario', 'precio_unit', 'unit_price', 'p_unit'].includes(h),
  );

  if (descIdx < 0 || totalIdx < 0) {
    warnings.push(
      'CSV: se espera una fila de encabezado con columnas "descripcion" (o producto) y "total" (o importe).',
    );
    return {
      title: null,
      merchant_ref: null,
      purchased_at: null,
      subtotal: null,
      discount_total: null,
      delivery_fee: null,
      grand_total: null,
      lines: [],
      warnings,
    };
  }

  const lines: ParsedReceiptLine[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = splitCsvLine(rows[i]);
    const description = (cells[descIdx] ?? '').trim();
    if (!description) continue;
    const totalRaw = (cells[totalIdx] ?? '').trim();
    const line_total =
      extractLastMoneyOnLine(totalRaw) ?? parseMoneyToken(totalRaw);
    if (line_total == null) continue;

    let quantity = 1;
    if (qtyIdx >= 0) {
      const q = Number.parseFloat((cells[qtyIdx] ?? '').replace(',', '.'));
      if (Number.isFinite(q) && q > 0) quantity = q;
    }

    let unit_label: string | null = null;
    if (unitIdx >= 0 && cells[unitIdx]?.trim()) {
      unit_label = cells[unitIdx]!.trim();
    }

    let unit_price: number | null = null;
    if (unitPriceIdx >= 0) {
      const up =
        parseMoneyToken((cells[unitPriceIdx] ?? '').replace(/,/g, '')) ??
        Number.parseFloat((cells[unitPriceIdx] ?? '').replace(',', '.'));
      if (Number.isFinite(up)) unit_price = up;
    } else if (quantity > 0) {
      unit_price = Math.round((line_total / quantity) * 100) / 100;
    }

    lines.push({
      description,
      quantity,
      unit_label,
      unit_price,
      line_total,
    });
  }

  if (lines.length === 0) {
    warnings.push('CSV: no se importó ningún renglón válido.');
  }

  return {
    title: null,
    merchant_ref: null,
    purchased_at: null,
    subtotal: null,
    discount_total: null,
    delivery_fee: null,
    grand_total: null,
    lines,
    warnings,
  };
};

const splitCsvRows = (raw: string): string[] => {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  return lines.filter((l) => l.length > 0);
};

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
};

type PdfTextItem = { str: string; transform: number[]; width?: number };

const extractPdfRowsWithLayout = async (pdf: {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
}): Promise<ReceiptTextRow[]> => {
  const rowsOut: ReceiptTextRow[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items: Array<{ x: number; y: number; w: number; str: string }> = [];
    let totalChars = 0;
    let totalWidth = 0;
    for (const raw of content.items) {
      const item = raw as PdfTextItem;
      if (typeof item.str !== 'string' || !Array.isArray(item.transform)) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const w = item.width ?? 0;
      items.push({ x, y, w, str: item.str });
      if (item.str.length > 0 && w > 0) {
        totalChars += item.str.length;
        totalWidth += w;
      }
    }
    const avgCharWidth = totalChars > 0 ? totalWidth / totalChars : 4;
    const columnGapThreshold = Math.max(2, avgCharWidth * 1.6);

    const rows = new Map<number, Array<{ x: number; w: number; str: string }>>();
    for (const it of items) {
      const arr = rows.get(it.y) ?? [];
      arr.push({ x: it.x, w: it.w, str: it.str });
      rows.set(it.y, arr);
    }
    const ys = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const cells = rows.get(y)!.sort((a, b) => a.x - b.x);
      const rowCells: ReceiptTextCell[] = [];
      let currentCell = '';
      let currentX = 0;
      let currentWidth = 0;
      let prevEnd = -Infinity;
      for (const cell of cells) {
        const gap = cell.x - prevEnd;
        if (currentCell === '') {
          currentCell = cell.str;
          currentX = cell.x;
          currentWidth = cell.w;
        } else if (gap > columnGapThreshold) {
          rowCells.push({ text: currentCell.trim(), x: currentX, width: currentWidth });
          currentCell = cell.str;
          currentX = cell.x;
          currentWidth = cell.w;
        } else {
          currentCell += cell.str;
          currentWidth = cell.x + cell.w - currentX;
        }
        prevEnd = cell.x + cell.w;
      }
      if (currentCell.trim()) {
        rowCells.push({ text: currentCell.trim(), x: currentX, width: currentWidth });
      }
      const text = rowCells.map((cell) => cell.text).join('\t').trim();
      if (text) rowsOut.push({ text, cells: rowCells, page: i, y });
    }
  }
  return rowsOut;
};

export type ParseUploadInput = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export const parsePantryReceiptUpload = async ({
  buffer,
  mimeType,
  fileName,
}: ParseUploadInput): Promise<ParsedReceipt> => {
  const warnings: string[] = [];
  const lowerMime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();

  if (buffer.length > MAX_FILE_BYTES) {
    return {
      title: null,
      merchant_ref: null,
      purchased_at: null,
      subtotal: null,
      discount_total: null,
      delivery_fee: null,
      grand_total: null,
      lines: [],
      warnings: [
        `El archivo supera el límite de ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
      ],
    };
  }

  if (
    lowerMime.includes('csv') ||
    name.endsWith('.csv') ||
    (lowerMime.includes('text/plain') && name.endsWith('.csv'))
  ) {
    const text = buffer.toString('utf8');
    return parseCsvToReceipt(text);
  }

  if (name.endsWith('.pdf') || lowerMime.includes('pdf')) {
    try {
      const { getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const rows = await extractPdfRowsWithLayout(pdf);
      if (rows.length === 0) {
        warnings.push(
          'El PDF no contiene texto seleccionable (puede ser solo imagen). Prueba exportar o subir CSV.',
        );
        return {
          title: null,
          merchant_ref: null,
          purchased_at: null,
          subtotal: null,
          discount_total: null,
          delivery_fee: null,
          grand_total: null,
          lines: [],
          warnings,
        };
      }
      const parsed = parsePantryReceiptRows(
        rows,
        rows.some((row) => row.cells.length > 1),
      );
      trace(parsed, {
        phase: 'extract',
        message: `Extracted ${rows.length} layout rows from PDF`,
      });
      parsed.warnings = [...parsed.warnings, ...warnings];
      return parsed;
    } catch (e) {
      console.error('PDF parse error', e);
      return {
        title: null,
        merchant_ref: null,
        purchased_at: null,
        subtotal: null,
        discount_total: null,
        delivery_fee: null,
        grand_total: null,
        lines: [],
        warnings: [
          'No se pudo leer el PDF. Intenta con CSV o un PDF generado desde el navegador.',
        ],
      };
    }
  }

  if (
    lowerMime.includes('text/plain') ||
    name.endsWith('.txt') ||
    lowerMime === 'application/octet-stream'
  ) {
    const text = buffer.toString('utf8');
    if (text.includes(',') && splitCsvLine(text.split(/\r?\n/)[0] ?? '').length >= 2) {
      const asCsv = parseCsvToReceipt(text);
      if (asCsv.lines.length > 0) return asCsv;
    }
    return parsePantryReceiptText(text);
  }

  return {
    title: null,
    merchant_ref: null,
    purchased_at: null,
    subtotal: null,
    discount_total: null,
    delivery_fee: null,
    grand_total: null,
    lines: [],
    warnings: [
      'Formato no soportado. Usa PDF, CSV o TXT (lista con tabuladores y precios $).',
    ],
  };
};
