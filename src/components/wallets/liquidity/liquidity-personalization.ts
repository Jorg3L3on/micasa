import type { LiquidityProjectionResponse } from '@/types/catalog';
import { formatCurrency } from '@/lib/utils';

export type LiquidityHealth = 'healthy' | 'warning' | 'critical';

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

export const getLiquidityHealth = (
  data: LiquidityProjectionResponse,
): LiquidityHealth => {
  const projected = data.summary.net_liquidity_versus_obligations_including_income;
  if (projected < 0) return 'critical';
  if (data.summary.first_projected_shortfall_date) return 'warning';
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
): LiquidityHeroCopy => {
  const health = getLiquidityHealth(data);
  const until = formatLiquidityDateLabel(data.until);
  const shortfallMonth = data.summary.first_projected_shortfall_date
    ? formatLiquidityDateLabel(data.summary.first_projected_shortfall_date)
    : null;
  const prefix = firstName ? `${firstName}, ` : '';

  if (health === 'healthy') {
    return {
      title: `${prefix}vas bien con tu dinero`,
      subtitle: `Con lo que tienes hoy y lo que esperamos que entre, te alcanza hasta ${until}.`,
      badge: 'Vas bien',
      tone: 'emerald',
    };
  }

  if (health === 'warning') {
    return {
      title: `${prefix}un mes se te puede apretar`,
      subtitle: shortfallMonth
        ? `Contando tus ingresos, en ${shortfallMonth} podría faltarte dinero. Revisa pagos grandes o tarjetas muy llenas.`
        : `Hay meses donde conviene cuidar más tus gastos hasta ${until}.`,
      badge: 'Presta atención',
      tone: 'amber',
    };
  }

  const missing = Math.abs(
    data.summary.net_liquidity_versus_obligations_including_income,
  );

  return {
    title: `${prefix}te falta dinero para cubrir lo que debes`,
    subtitle: `Aun contando lo que esperamos que entre, faltarían ${formatCurrency(missing)} hasta ${until}.`,
    badge: 'Te falta',
    tone: 'destructive',
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
