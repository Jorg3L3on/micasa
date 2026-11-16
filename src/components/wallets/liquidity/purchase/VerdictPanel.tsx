'use client';

import type { ReactNode } from 'react';
import { CalendarRange, CircleCheck, CircleX, CreditCard, Scale, TriangleAlert, TrendingDown, Wallet } from 'lucide-react';
import { AccountMetric } from '@/components/monthly/FortnightSummaryHero';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { Badge } from '@/components/ui/badge';
import { formatDisplayDate } from '@/lib/calendar-dates';
import type { PurchaseSimulationResult } from '@/lib/finance/purchase-simulation/simulate';
import { formatMoney } from '@/lib/money';
import { STATUS_SOFT_CLASS, STATUS_TEXT_CLASS, type StatusTone } from '@/lib/status-tone';
import { AURA_TONE_HEX, getAuraBloomImage } from '@/lib/ui/aura-palette';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import { levelTone, quincenaShort, verdictCopy } from '@/components/wallets/liquidity/purchase/format';

const ICON = { green: CircleCheck, amber: TriangleAlert, red: CircleX } as const;
const BLOOM = { green: AURA_TONE_HEX.emerald, amber: AURA_TONE_HEX.amber, red: AURA_TONE_HEX.destructive } as const;

/** Panel's status chip: soft fill, no border, caption weight (same as "Holgado" / "Saludable"). */
const StatusChip = ({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) => (
  <Badge variant="outline" className={cn('h-5 shrink-0 rounded-full border-transparent px-2 text-caption font-semibold', STATUS_SOFT_CLASS[tone], className)}>
    {children}
  </Badge>
);

export const VerdictPanel = ({ result, dimmed }: { result: PurchaseSimulationResult; dimmed?: boolean }) => {
  const debtCard = typeof result.plan.debtWalletId === 'number' ? result.wallets.find((w) => w.id === result.plan.debtWalletId) : null;
  const copy = verdictCopy(result.verdict, result.series, result.plan, debtCard?.name ?? null);
  const tone = levelTone(copy.level);
  const Icon = ICON[copy.level];
  return (
    <section
      aria-labelledby="sc-verdict"
      aria-live="polite"
      className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4', dimmed && 'opacity-50')}
      style={{ backgroundImage: getAuraBloomImage(BLOOM[copy.level]) }}
    >
      <SectionHeader
        id="sc-verdict"
        icon={Scale}
        title={C.verdictEyebrow}
        subtitle={copy.scope}
        actions={
          <StatusChip tone={tone}>
            <Icon className="mr-1 size-3" aria-hidden />
            {copy.chip}
          </StatusChip>
        }
      />
      <p className={cn('mt-3 text-2xl font-bold leading-tight tracking-tight', STATUS_TEXT_CLASS[tone])}>{copy.headline}</p>
      <p className="mt-1.5 text-body text-foreground/90">{copy.sentence}</p>
      {copy.justa ? <p className="mt-1.5 text-sm text-status-pending">{copy.justa}</p> : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/50 pt-2.5 text-caption text-muted-foreground">
        <span>{copy.compare}</span>
        <span>{C.disclaimer}</span>
      </div>
    </section>
  );
};

type Tile = {
  label: string;
  amount: number;
  display?: string;
  subtitle: string;
  icon: typeof Wallet;
  tone: StatusTone | null;
  badge?: string;
};

export function kpiTiles(result: PurchaseSimulationResult): Tile[] {
  const { plan, verdict, series, wallets } = result;
  const byKey = new Map(series.map((r) => [r.key, r]));
  const tight = byKey.get(verdict.tightestKey)!;
  const red = verdict.redKeys.length;
  const ends = `termina ${formatDisplayDate(plan.lastDueDate)}`;
  const pay: Tile =
    plan.count === 1
      ? {
          label: 'Pagas',
          amount: plan.total,
          subtitle: plan.cutoffDate ? `Un solo pago el ${formatDisplayDate(plan.firstDueDate)}, sin intereses` : `Sale el ${formatDisplayDate(plan.purchaseDate)}`,
          icon: Wallet,
          tone: null,
        }
      : {
          label: 'Pagas cada mes',
          amount: plan.regularPayment,
          subtitle:
            plan.mode === 'msi'
              ? `${plan.count} pagos · sin intereses · ${ends}`
              : `${plan.count} pagos · ${formatMoney(plan.interest)} de intereses · ${ends}`,
          icon: CalendarRange,
          tone: null,
        };
  return [
    pay,
    {
      label: 'Quincenas en rojo',
      amount: red,
      display: `${red} de ${verdict.quincenas}`,
      subtitle: `Sin la compra: ${verdict.baselineRedCount}`,
      icon: TriangleAlert,
      tone: red > 0 ? 'overdue' : 'success',
      badge: red > 0 ? 'En rojo' : 'Sin rojos',
    },
    {
      label: 'La más justa',
      amount: verdict.tightestQueda,
      subtitle: `${quincenaShort(tight)} · sin la compra ${formatMoney(tight.sinCompra)}`,
      icon: TrendingDown,
      tone: verdict.tightestQueda < 0 ? 'overdue' : verdict.justaKeys.length > 0 ? 'pending' : 'success',
      badge: verdict.tightestQueda < 0 ? 'Falta' : verdict.justaKeys.length > 0 ? 'Justa' : 'Holgada',
    },
    walletTile(plan, wallets, verdict.overLimitBy),
  ];
}

/** Where the money comes from: the card's disponible, the debit balance, or the credit's total cost. */
function walletTile(plan: PurchaseSimulationResult['plan'], wallets: PurchaseSimulationResult['wallets'], overLimitBy: number): Tile {
  const card = typeof plan.debtWalletId === 'number' ? wallets.find((w) => w.id === plan.debtWalletId) : null;
  if (card && card.available != null) {
    return {
      label: `Disponible en ${card.name}`,
      amount: card.available,
      subtitle: overLimitBy > 0 ? `Te faltan ${formatMoney(overLimitBy)} para esta compra` : `Después de la compra: ${formatMoney(card.available - plan.principal)}`,
      icon: CreditCard,
      tone: overLimitBy > 0 ? 'overdue' : 'success',
      badge: overLimitBy > 0 ? 'No cabe' : 'Cabe',
    };
  }
  if (plan.debtWalletId === 'new') {
    const paid = plan.payments.reduce((s, p) => s + p.amount, 0);
    return { label: 'En total pagas', amount: paid, subtitle: `${formatMoney(plan.interest)} son intereses`, icon: Wallet, tone: null };
  }
  const wallet = wallets.find((w) => w.id === plan.payments[0]?.walletId);
  const balance = wallet?.balance ?? 0;
  const left = balance - plan.total;
  return {
    label: `Saldo en ${wallet?.name ?? 'tu billetera'}`,
    amount: balance,
    subtitle: left < 0 ? `Te faltan ${formatMoney(-left)} para esta compra` : `Después de la compra: ${formatMoney(left)}`,
    icon: Wallet,
    tone: left < 0 ? 'overdue' : 'success',
    badge: left < 0 ? 'No alcanza' : 'Alcanza',
  };
}

const AURA = { success: 'emerald', overdue: 'destructive', pending: 'amber', income: 'primary', expense: 'violet', info: 'blue' } as const;
const pill = (tone: StatusTone | null) => (tone ? STATUS_SOFT_CLASS[tone] : 'bg-primary/15 text-foreground');

/** Panel's hero tiles (AccountMetric), two per row like Balance actual / Liquidez actual. */
export const KpiTiles = ({ result, dimmed }: { result: PurchaseSimulationResult; dimmed?: boolean }) => (
  <div className={cn('grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4', dimmed && 'opacity-50')}>
    {kpiTiles(result).map((t) => (
      <AccountMetric
        key={t.label}
        label={t.label}
        amount={t.amount}
        display={t.display}
        subtitle={t.subtitle}
        glassSurface
        auraTone={t.tone ? AURA[t.tone] : 'primary'}
        pillClassName={pill(t.tone)}
        icon={t.icon}
        amountClassName={t.tone === 'overdue' ? 'text-status-overdue' : 'text-foreground'}
        badge={t.badge && t.tone ? { label: t.badge, tone: t.tone } : undefined}
      />
    ))}
  </div>
);
