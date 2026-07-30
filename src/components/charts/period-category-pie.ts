import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

export type CategoryPieRow = {
  category: string;
  categoryIcon?: string | null;
  total: number;
};

export type CategoryPieSlice = {
  name: string;
  category: string;
  categoryIcon?: string | null;
  value: number;
  pct: number;
};

/** Whisper Money–inspired chart accents: coral (gastos) + emerald, then vivid companions. */
export const CATEGORY_PIE_SLICE_COLORS = [
  '#ff4d6d',
  '#34d399',
  '#60a5fa',
  '#fbbf24',
  '#a78bfa',
  '#2dd4bf',
  '#fb923c',
  '#f472b6',
  '#38bdf8',
  '#4ade80',
  '#e879f9',
  '#f87171',
] as const;

const MAX_SLICES = 8;

export const bucketCategoryPieRows = (
  rows: CategoryPieRow[],
): Array<{
  name: string;
  category: string;
  categoryIcon?: string | null;
  value: number;
}> => {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  if (sorted.length <= MAX_SLICES) {
    return sorted.map((r) => ({
      name: formatCategoryLabel(r.category, r.categoryIcon),
      category: r.category,
      categoryIcon: r.categoryIcon,
      value: r.total,
    }));
  }
  const top = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otros = rest.reduce((s, r) => s + r.total, 0);
  return [
    ...top.map((r) => ({
      name: formatCategoryLabel(r.category, r.categoryIcon),
      category: r.category,
      categoryIcon: r.categoryIcon,
      value: r.total,
    })),
    { name: 'Otros', category: 'Otros', categoryIcon: null, value: otros },
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
