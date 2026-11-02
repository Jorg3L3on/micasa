import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDITED_MODELS } from '@/lib/server/audit/audited-models';
import { ENTITY_LABELS, fieldSpec, formatAuditValue, isVisibleField } from './labels';

type Column = { name: string; type: string; dateOnly: boolean };

/** Scalar columns per model, read from prisma/schema.prisma. */
const schemaColumns = (): Map<string, Column[]> => {
  const schema = readFileSync(path.resolve(__dirname, '../../../prisma/schema.prisma'), 'utf8');
  const blocks = [...schema.matchAll(/^model (\w+) \{\n([\s\S]*?)\n\}/gm)];
  const models = new Set(blocks.map((b) => b[1]!));
  const out = new Map<string, Column[]>();
  for (const [, model, body] of blocks) {
    const columns: Column[] = [];
    for (const line of body!.split('\n')) {
      const m = /^\s*(\w+)\s+(\w+)(\[\])?\??(.*)$/.exec(line);
      if (!m || line.trim().startsWith('//') || line.trim().startsWith('@@')) continue;
      if (models.has(m[2]!)) continue;
      columns.push({ name: m[1]!, type: m[2]! + (m[3] ?? ''), dateOnly: m[4]!.includes('@db.Date') });
    }
    out.set(model!, columns);
  }
  return out;
};

describe('audit labels', () => {
  const columns = schemaColumns();

  it('names every audited model in Spanish', () => {
    for (const { model } of AUDITED_MODELS) {
      expect(ENTITY_LABELS[model], model).toBeDefined();
    }
  });

  it('labels every visible column of every audited model with a kind that fits its type', () => {
    for (const audited of AUDITED_MODELS) {
      const visible = (columns.get(audited.model) ?? []).filter(
        (c) =>
          isVisibleField(c.name) &&
          (!audited.allowColumns || audited.allowColumns.includes(c.name)) &&
          !(audited.denyColumns ?? []).includes(c.name),
      );
      expect(visible.length, audited.model).toBeGreaterThan(0);
      for (const column of visible) {
        const spec = fieldSpec(audited.model, column.name);
        const where = `${audited.model}.${column.name}`;
        expect(spec.label, where).not.toBe(column.name);
        if (column.type === 'Decimal') expect(['money', 'percent'], where).toContain(spec.kind);
        if (column.type === 'DateTime') expect(['date', 'datetime'], where).toContain(spec.kind);
        if (column.type === 'Boolean') expect(spec.kind, where).toBe('boolean');
        if (column.name.endsWith('_id')) expect(spec.kind, where).toBe('ref');
      }
    }
  });

  it('formats values the way forms show them', () => {
    expect(formatAuditValue('Expense', 'amount', 1234.5)).toBe('$1,234.50');
    expect(formatAuditValue('Expense', 'is_paid', true)).toBe('Sí');
    expect(formatAuditValue('Expense', 'payment_date', '2025-09-02T06:00:00')).toMatch(/2 sept?\.? 2025/);
    expect(formatAuditValue('LoanPayment', 'due_date', '2025-02-15')).toMatch(/15 feb\.? 2025/);
    expect(formatAuditValue('Wallet', 'type', 'CREDIT_CARD')).toBe('Tarjeta de crédito');
    expect(formatAuditValue('Wallet', 'apr_annual', 0.42)).toBe('42 %');
    expect(formatAuditValue('Expense', 'wallet_id', 12)).toBe('#12');
    expect(formatAuditValue('Expense', 'description', null)).toBe('—');
  });
});
