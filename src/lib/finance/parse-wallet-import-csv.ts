export type WalletImportCsvRow = {
  line: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
};

export type WalletImportCsvIssue = {
  line: number;
  message: string;
};

const HEADER_KEYS = ['date', 'description', 'amount', 'category', 'type'] as const;

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else if (c === '"') {
      inQuotes = true;
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

/** Parse wallet movement CSV into rows and per-line import issues. */
export const parseWalletImportCsv = (
  raw: string,
): { rows: WalletImportCsvRow[]; issues: WalletImportCsvIssue[] } => {
  const issues: WalletImportCsvIssue[] = [];
  const rows: WalletImportCsvRow[] = [];

  const cleaned = raw.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, issues };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx: Record<(typeof HEADER_KEYS)[number], number> = {
    date: header.indexOf('date'),
    description: header.indexOf('description'),
    amount: header.indexOf('amount'),
    category: header.indexOf('category'),
    type: header.indexOf('type'),
  };

  for (const key of HEADER_KEYS) {
    if (idx[key] === -1) {
      issues.push({
        line: 1,
        message: `Falta la columna "${key}" en el encabezado`,
      });
    }
  }
  if (issues.length > 0) return { rows, issues };

  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    const date = parts[idx.date] ?? '';
    const description = parts[idx.description] ?? '';
    const amountStr = parts[idx.amount] ?? '';
    const category = parts[idx.category] ?? '';
    const typeStr = (parts[idx.type] ?? '').toLowerCase();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      issues.push({ line: i + 1, message: 'Fecha inválida (usa YYYY-MM-DD)' });
      continue;
    }
    if (!description) {
      issues.push({ line: i + 1, message: 'Descripción vacía' });
      continue;
    }
    const amount = Number(amountStr.replace(/[,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push({ line: i + 1, message: 'Monto inválido' });
      continue;
    }
    if (typeStr !== 'expense' && typeStr !== 'income') {
      issues.push({
        line: i + 1,
        message: 'Tipo debe ser "expense" o "income"',
      });
      continue;
    }
    rows.push({
      line: i + 1,
      date,
      description,
      amount,
      category,
      type: typeStr,
    });
  }
  return { rows, issues };
};
