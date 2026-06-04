import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

export type CategoryPieRow = {
  category: string;
  categoryIcon?: string | null;
  total: number;
};

export type CategoryPieSlice = { name: string; value: number; pct: number };

export const CATEGORY_PIE_SLICE_COLORS = [
  '#6366f1',
  '#10b981',
  '#f97316',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
  '#0ea5e9',
  '#a855f7',
] as const;

const MAX_SLICES = 8;

export const bucketCategoryPieRows = (
  rows: CategoryPieRow[],
): Array<{ name: string; value: number }> => {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  if (sorted.length <= MAX_SLICES) {
    return sorted.map((r) => ({
      name: formatCategoryLabel(r.category, r.categoryIcon),
      value: r.total,
    }));
  }
  const top = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otros = rest.reduce((s, r) => s + r.total, 0);
  return [
    ...top.map((r) => ({
      name: formatCategoryLabel(r.category, r.categoryIcon),
      value: r.total,
    })),
    { name: 'Otros', value: otros },
  ];
};

export const buildCategoryPieChartData = (
  rows: CategoryPieRow[],
): CategoryPieSlice[] => {
  const buckets = bucketCategoryPieRows(rows);
  const sum = buckets.reduce((s, r) => s + r.value, 0);
  if (sum <= 0) return [];
  return buckets.map((r) => ({
    ...r,
    pct: (r.value / sum) * 100,
  }));
};
