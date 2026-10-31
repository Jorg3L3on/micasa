import { addCalendarDays, isValidCalendarDateString } from '@/lib/calendar-dates';
import type { BatchRowKind } from './batch-entry';

export type ParsedLine = {
  kind: BatchRowKind;
  name: string;
  amount: number | '';
  date: string;
  walletId: number;
  /** Suggested from past movements with the same name; the user can change it. */
  categoryId: number;
};

type WalletRef = { id: number; name: string };

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const AMOUNT_RE = /^\$?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;
const pad = (n: number) => String(n).padStart(2, '0');

function parseDateToken(token: string, today: string): string | null {
  const t = normalize(token);
  if (t === 'hoy') return today;
  if (t === 'ayer') return addCalendarDays(today, -1);
  if (t === 'anteayer') return addCalendarDays(today, -2);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return isValidCalendarDateString(t) ? t : null;
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  if (year < 100) year += 2000;
  const ymd = `${year}-${pad(month)}-${pad(day)}`;
  return isValidCalendarDateString(ymd) ? ymd : null;
}

/**
 * Parses pasted notes, one movement per line:
 *   `café 45`, `súper 820 BBVA`, `+sueldo 12000`, `ayer taxi 80`, `12/10 comida 150`.
 * A leading `+` (or the word `ingreso`) marks an ingreso. Wallet is matched by
 * name inside the line. Nothing here saves anything: callers show the result
 * as editable draft rows.
 */
export function parseQuickLines(
  text: string,
  options: {
    today: string;
    wallets: WalletRef[];
    /** name (any case) -> categoryId, from recent movements. */
    categoryByName?: Map<string, number>;
    defaultWalletId?: number;
  },
): ParsedLine[] {
  const out: ParsedLine[] = [];
  const walletsByLength = [...options.wallets].sort(
    (a, b) => b.name.length - a.name.length,
  );

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;

    let kind: BatchRowKind = 'expense';
    if (line.startsWith('+')) {
      kind = 'income';
      line = line.slice(1).trim();
    }

    // Wallet: longest name found as whole words anywhere in the line.
    let walletId = options.defaultWalletId ?? 0;
    const normalizedLine = ` ${normalize(line)} `;
    for (const wallet of walletsByLength) {
      const needle = ` ${normalize(wallet.name)} `;
      const at = normalizedLine.indexOf(needle);
      if (at >= 0) {
        walletId = wallet.id;
        // Remove from the original line by matching the same words case-insensitively.
        const re = new RegExp(
          `(^|\\s)${wallet.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`,
          'i',
        );
        line = line.replace(re, ' ').trim();
        break;
      }
    }

    let tokens = line.split(/\s+/).filter(Boolean);
    if (tokens[0] && normalize(tokens[0]) === 'ingreso') {
      kind = 'income';
      tokens = tokens.slice(1);
    }

    let date = options.today;
    const dateIdx = tokens.findIndex((t) => parseDateToken(t, options.today));
    if (dateIdx >= 0) {
      date = parseDateToken(tokens[dateIdx], options.today)!;
      tokens.splice(dateIdx, 1);
    }

    let amount: number | '' = '';
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      if (AMOUNT_RE.test(tokens[i])) {
        amount = Number(tokens[i].replace(/[$,]/g, ''));
        tokens.splice(i, 1);
        break;
      }
    }

    const name = tokens.join(' ').trim();
    if (!name && amount === '') continue;

    out.push({
      kind,
      name,
      amount,
      date,
      walletId,
      categoryId: options.categoryByName?.get(normalize(name)) ?? 0,
    });
  }
  return out;
}

export function buildCategoryByName(
  recent: { description: string; categoryId: number | null }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of recent) {
    const key = normalize(item.description);
    if (item.categoryId && !map.has(key)) map.set(key, item.categoryId);
  }
  return map;
}
