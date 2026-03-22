export type ParsedReceiptLine = {
  description: string;
  quantity: number;
  unit_label: string | null;
  unit_price: number | null;
  line_total: number;
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

const parseMoneyToken = (token: string): number | null => {
  const cleaned = token.replace(/[$\s]/g, '').replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

const extractLastMoneyOnLine = (line: string): number | null => {
  const re = /\$\s*([\d,]+\.\d{2})/g;
  let last: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const v = parseMoneyToken(m[0]);
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

const parseProductLine = (line: string): ParsedReceiptLine | null => {
  if (!line.includes('\t')) return null;
  if (!/\$\s*[\d,]+\.\d{2}/.test(line)) return null;

  const lineTotal = extractLastMoneyOnLine(line);
  if (lineTotal == null) return null;

  const dollarIdx = line.lastIndexOf('$');
  const beforeDollar = line.slice(0, dollarIdx).trimEnd();
  const cells = beforeDollar
    .split('\t')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const desc = cells[0]?.trim() ?? '';
  if (desc.length < 2) return null;

  let quantity = 1;
  let unit_label: string | null = null;
  let unit_price: number | null = null;

  if (cells.length >= 2) {
    const mid = cells[cells.length - 1];
    const qm = mid.match(/^(\d+(?:\.\d+)?)\s*(kg|pz)\s*$/i);
    if (qm) {
      quantity = Number.parseFloat(qm[1]);
      unit_label = qm[2].toLowerCase();
      if (Number.isFinite(quantity) && quantity > 0) {
        unit_price = Math.round((lineTotal / quantity) * 100) / 100;
      }
    }
  }

  return {
    description: desc,
    quantity: Number.isFinite(quantity) ? quantity : 1,
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
  if (!line.includes('\t')) return;
  const parts = line.split('\t');
  const last = parts[parts.length - 1]?.trim() ?? '';
  const amount = extractLastMoneyOnLine(last) ?? parseMoneyToken(last);
  if (amount == null) return;
  if (key === 'discount_total' && last.startsWith('-')) {
    target.discount_total = Math.abs(amount);
    return;
  }
  target[key] = Math.abs(amount);
};

/**
 * Parses plain text / PDF-extracted text from grocery receipts (e.g. Bodega Aurrera despensa PDFs).
 */
export const parsePantryReceiptText = (raw: string): ParsedReceipt => {
  const result: ParsedReceipt = {
    title: null,
    merchant_ref: null,
    purchased_at: null,
    subtotal: null,
    discount_total: null,
    delivery_fee: null,
    grand_total: null,
    lines: [],
    warnings: [],
  };

  const lines = raw.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue;
    if (line.startsWith('http://') || line.startsWith('https://')) continue;
    if (/^Código de barras/i.test(line)) continue;
    if (/Detalles del pedido/i.test(line) && line.includes('\t')) {
      const left = line.split('\t')[0] ?? '';
      if (/Detalles del pedido/i.test(left)) {
        result.title = left.replace(/\s+/g, ' ').trim();
      }
      continue;
    }

    if (/^Pedido el\b/i.test(line)) {
      result.purchased_at = parsePedidoDate(line);
      continue;
    }

    const pedidoHash = line.match(/^Pedido#([\w-]+)/i);
    if (pedidoHash) {
      result.merchant_ref = pedidoHash[1] ?? null;
      continue;
    }

    if (/^Subtotal\b/i.test(line)) {
      parseSummaryLine(line, 'subtotal', result);
      continue;
    }
    if (/^Descuento\b/i.test(line) && !/envío/i.test(line)) {
      parseSummaryLine(line, 'discount_total', result);
      continue;
    }
    if (/^Descuento en envío/i.test(line)) continue;
    if (/^Costo de entrega/i.test(line)) {
      parseSummaryLine(line, 'delivery_fee', result);
      continue;
    }
    if (/^Total\b/i.test(line)) {
      parseSummaryLine(line, 'grand_total', result);
      continue;
    }
    if (/^Método/i.test(line) || /^de$/i.test(line) || /^pago$/i.test(line)) {
      continue;
    }

    const product = parseProductLine(line);
    if (product) {
      result.lines.push(product);
    }
  }

  if (result.lines.length === 0) {
    result.warnings.push(
      'No se detectaron productos en el archivo. Puedes agregar renglones manualmente o subir un CSV con columnas: descripcion, cantidad, total.',
    );
  }

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
  const rows = splitCsvRows(raw);
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
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
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
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      await parser.destroy();
      const text = textResult.text ?? '';
      if (!text.trim()) {
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
      const parsed = parsePantryReceiptText(text);
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
