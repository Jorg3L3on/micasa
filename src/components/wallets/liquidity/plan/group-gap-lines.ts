import type { GapBreakdownLine } from '@/lib/finance/cash-plan/types';

export type GapBreakdownRow =
  | { kind: 'line'; line: GapBreakdownLine }
  | {
      kind: 'lender';
      id: string;
      label: string;
      total: number;
      lines: GapBreakdownLine[];
    };

/** Fold loan lines that share a prestamista into one total, in first-seen order. */
export const groupGapBreakdownLines = (lines: GapBreakdownLine[]): GapBreakdownRow[] => {
  const rows: GapBreakdownRow[] = [];
  const indexByGroup = new Map<string, number>();

  for (const line of lines) {
    const group = line.group;
    if (!group) {
      rows.push({ kind: 'line', line });
      continue;
    }
    const existingIndex = indexByGroup.get(group.id);
    if (existingIndex == null) {
      indexByGroup.set(group.id, rows.length);
      rows.push({
        kind: 'lender',
        id: group.id,
        label: group.label,
        total: line.amount,
        lines: [line],
      });
      continue;
    }
    const row = rows[existingIndex];
    if (row?.kind !== 'lender') continue;
    row.lines.push(line);
    row.total += line.amount;
  }

  return rows;
};
