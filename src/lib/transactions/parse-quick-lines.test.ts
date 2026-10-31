import { describe, expect, it } from 'vitest';
import { buildCategoryByName, parseQuickLines } from './parse-quick-lines';

const wallets = [
  { id: 1, name: 'Efectivo' },
  { id: 2, name: 'BBVA Débito' },
  { id: 3, name: 'BBVA' },
];
const base = { today: '2026-10-15', wallets };

describe('parseQuickLines', () => {
  it('parses name and amount with today as the date', () => {
    expect(parseQuickLines('café 45', base)).toEqual([
      { kind: 'expense', name: 'café', amount: 45, date: '2026-10-15', walletId: 0, categoryId: 0 },
    ]);
  });

  it('treats a leading + as ingreso and parses thousands separators', () => {
    const [row] = parseQuickLines('+sueldo 12,000.50', base);
    expect(row).toMatchObject({ kind: 'income', name: 'sueldo', amount: 12000.5 });
  });

  it('matches the longest wallet name and strips it from the name', () => {
    const [row] = parseQuickLines('súper 820 BBVA Débito', base);
    expect(row).toMatchObject({ name: 'súper', amount: 820, walletId: 2 });
    const [short] = parseQuickLines('gasolina 500 bbva', base);
    expect(short).toMatchObject({ name: 'gasolina', walletId: 3 });
  });

  it('understands ayer, hoy and d/m dates', () => {
    expect(parseQuickLines('ayer taxi 80', base)[0].date).toBe('2026-10-14');
    expect(parseQuickLines('12/10 comida 150', base)[0].date).toBe('2026-10-12');
    expect(parseQuickLines('comida 150 2026-10-01', base)[0].date).toBe('2026-10-01');
  });

  it('keeps invalid dates as part of the name instead of guessing', () => {
    const [row] = parseQuickLines('31/02 cena 200', base);
    expect(row.date).toBe('2026-10-15');
    expect(row.name).toBe('31/02 cena');
  });

  it('skips blank lines and leaves amount empty when there is none', () => {
    const rows = parseQuickLines('\n\npropina\n', base);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'propina', amount: '' });
  });

  it('uses the default wallet and suggests a category from recent names', () => {
    const categoryByName = buildCategoryByName([
      { description: 'Café', categoryId: 9 },
      { description: 'otro', categoryId: null },
    ]);
    const [row] = parseQuickLines('café 45', {
      ...base,
      defaultWalletId: 1,
      categoryByName,
    });
    expect(row).toMatchObject({ walletId: 1, categoryId: 9 });
  });
});
