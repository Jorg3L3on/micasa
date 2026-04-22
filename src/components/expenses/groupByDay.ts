import type { ExpenseFeedItem } from '@/types/expenses-feed';

export type ExpenseDayGroup = {
  key: string;
  label: string;
  items: ExpenseFeedItem[];
};

const DAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const date = parseLocalDate(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return 'Hoy';
  if (sameDay(date, yesterday)) return 'Ayer';

  const dayName = DAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const includeYear = date.getFullYear() !== now.getFullYear();
  const base = `${cap(dayName)} ${day} de ${month}`;
  return includeYear ? `${base} de ${date.getFullYear()}` : base;
}

export function groupByDay(
  items: ExpenseFeedItem[],
  now: Date = new Date(),
): ExpenseDayGroup[] {
  const groups = new Map<string, ExpenseFeedItem[]>();
  for (const item of items) {
    const key = item.date;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, groupItems]) => ({
      key,
      label: formatDayLabel(key, now),
      items: groupItems,
    }));
}
