import type { LiquidityProjectionResponse } from '@/types/catalog';
import { formatCurrency } from '@/lib/utils';

export type LiquidityHealth = 'healthy' | 'warning' | 'critical';

export type LiquidityHorizonMonths = 3 | 6 | 12;

export const LIQUIDITY_HORIZON_OPTIONS: Array<{
  value: LiquidityHorizonMonths;
  label: string;
  hint: string;
}> = [
  { value: 3, label: '3 meses', hint: 'Lo más cercano' },
  { value: 6, label: '6 meses', hint: 'Mediano plazo' },
  { value: 12, label: '12 meses', hint: 'Todo el año' },
];

export const formatLiquidityDateLabel = (ymd: string): string => {
  const [y, m, day] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const formatMonthYearLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const formatShortMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString('es-MX', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
};

export const compareMonthKeys = (a: string, b: string): number => a.localeCompare(b);

export const monthKeyFromParts = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

export const shiftSelectedMonthKey = (
  monthKeys: readonly string[],
  currentKey: string,
  delta: number,
): string => {
  if (monthKeys.length === 0) return currentKey;
  const index = monthKeys.indexOf(currentKey);
  const from = index >= 0 ? index : 0;
  const next = Math.min(monthKeys.length - 1, Math.max(0, from + delta));
  return monthKeys[next] ?? currentKey;
};

const formatMonthYearFromYmd = (ymd: string): string => formatMonthYearLabel(ymd.slice(0, 7));

export const getTightestMonth = (
  data: LiquidityProjectionResponse,
): { monthKey: string; remaining: number } | null => {
  let tightest: { monthKey: string; remaining: number } | null = null;
  for (const month of data.monthly_series) {
    if (tightest == null || month.monthly_remaining < tightest.remaining) {
      tightest = { monthKey: month.month_key, remaining: month.monthly_remaining };
    }
  }
  return tightest;
};

export const getLiquidityHealth = (
  data: LiquidityProjectionResponse,
): LiquidityHealth => {
  const tightest = getTightestMonth(data);
  if (!tightest) return 'healthy';
  if (tightest.remaining < 0) return 'critical';
  if (tightest.remaining < data.summary.funding_total * 0.15) return 'warning';
  return 'healthy';
};

export type LiquidityHeroCopy = {
  title: string;
  subtitle: string;
  badge: string;
  tone: 'emerald' | 'amber' | 'destructive';
};

export const buildLiquidityHeroCopy = (
  data: LiquidityProjectionResponse,
  firstName?: string,
  horizonMonths: LiquidityHorizonMonths = 6,
): LiquidityHeroCopy => {
  const health = getLiquidityHealth(data);
  const prefix = firstName ? `${firstName}, ` : '';
  const tightest = getTightestMonth(data);
  const horizonLabel = `${horizonMonths} meses`;
  const upcomingEvents = data.projection_events?.length ?? 0;

  if (health === 'healthy') {
    return {
      title: `${prefix}tus pagos se ven manejables`,
      subtitle: `En los próximos ${horizonLabel}, mes a mes, tus ingresos cubren lo que debes pagar. ${
        upcomingEvents > 0
          ? `Tienes ${upcomingEvents} fechas importantes donde terminas de pagar algo.`
          : 'Revisa la gráfica para ver cómo bajan tus pagos.'
      }`,
      badge: 'Vas bien',
      tone: 'emerald',
    };
  }

  if (health === 'warning' && tightest) {
    return {
      title: `${prefix}en ${formatMonthYearLabel(tightest.monthKey)} conviene cuidar más`,
      subtitle: `Ese mes te quedaría poco margen después de pagar todo. No es un saldo de fin de año: es ese mes en particular.`,
      badge: 'Presta atención',
      tone: 'amber',
    };
  }

  if (tightest) {
    return {
      title: `${prefix}en ${formatMonthYearLabel(tightest.monthKey)} podría no alcanzar`,
      subtitle: `Ese mes tus pagos superan lo que esperamos que entre. Mira la gráfica y los hitos para ver qué se termina de pagar antes o después.`,
      badge: 'Mes apretado',
      tone: 'destructive',
    };
  }

  return {
    title: `${prefix}revisa mes a mes`,
    subtitle: `Usa la gráfica de los próximos ${horizonLabel} para ver cómo van bajando tus pagos.`,
    badge: 'Revisa',
    tone: 'amber',
  };
};

export const getCardRiskLabel = (
  utilization: number | null,
  isUnrated: boolean,
): { label: string; tone: 'emerald' | 'amber' | 'destructive' | 'muted' } => {
  if (isUnrated) return { label: 'Sin límite', tone: 'muted' };
  if (utilization == null) return { label: 'Sin dato', tone: 'muted' };
  if (utilization > 80) return { label: 'Muy llena', tone: 'destructive' };
  if (utilization > 50) return { label: 'Casi llena', tone: 'amber' };
  return { label: 'Tranquila', tone: 'emerald' };
};

export { formatMonthYearFromYmd };
