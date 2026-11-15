'use client';

import { useId } from 'react';
import { Info, Minus, Plus, ShoppingBag, TriangleAlert } from 'lucide-react';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { SegmentedControl } from '@/components/segmented-control';
import {
  AmountRow,
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
  OverlayWarning,
} from '@/components/overlay/overlay-form';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { formatDisplayDate } from '@/lib/calendar-dates';
import { MSI_MONTH_OPTIONS } from '@/lib/finance/purchase-simulation/constants';
import type { PurchaseSimulationResult, SimulationWallet } from '@/lib/finance/purchase-simulation/purchase-simulation.service';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import { quincenaShort } from '@/components/wallets/liquidity/purchase/format';
import type { PurchaseDraft, PurchaseMode } from '@/components/wallets/liquidity/purchase/use-purchase-simulation';

const CHIP = 'min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';
const chipClass = (on: boolean) =>
  cn(CHIP, on ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 bg-white/[0.03] text-foreground hover:bg-white/[0.06]');

const NEW_CREDIT_TERMS = [12, 24, 36, 48, 60, 72];
const CARD_CREDIT_TERMS = [3, 6, 12, 18, 24];

export const EXAMPLES: { label: string; patch: Partial<PurchaseDraft> }[] = [
  { label: 'Celular a 12 MSI', patch: { name: 'Celular', total: 12000, mode: 'msi', months: 12 } },
  { label: 'Viaje de contado', patch: { name: 'Viaje', total: 15000, mode: 'contado' } },
  { label: 'Auto a crédito', patch: { name: 'Auto', total: 300000, mode: 'credito', lender: 'new', creditMonths: 48, rate: 13.9, down: null, extra: 2500 } },
];

const walletInfo = (w: SimulationWallet) =>
  w.isCard
    ? [w.available != null ? `Disponible ${formatMoney(w.available)}` : null, w.cutoffDay ? `corte ${w.cutoffDay}` : 'sin día de corte', w.dueDay ? `pago ${w.dueDay}` : null]
        .filter(Boolean)
        .join(' · ')
    : `Saldo ${formatMoney(w.balance ?? 0)}`;

/** One select for every wallet choice: trigger shows the chosen one, the menu groups cards and cash/debit. */
export const WalletSelect = ({
  label,
  wallets,
  value,
  onChange,
  showInfo = true,
}: {
  label: string;
  wallets: SimulationWallet[];
  value: number | null;
  onChange: (id: number) => void;
  showInfo?: boolean;
}) => {
  const id = useId();
  const selected = wallets.find((w) => w.id === value) ?? null;
  const cards = wallets.filter((w) => w.isCard);
  const funding = wallets.filter((w) => !w.isCard);
  const item = (w: SimulationWallet) => (
    <SelectItem key={w.id} value={String(w.id)} className="min-h-11 py-2">
      <WalletProviderIcon providerIconKey={w.providerIconKey} className="size-6" showTooltipLabel={false} />
      <span className="flex min-w-0 flex-col items-start">
        <span className="truncate font-medium">{w.name}</span>
        <span className="text-caption text-muted-foreground">{walletInfo(w)}</span>
      </span>
    </SelectItem>
  );
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block px-1 text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger id={id} className="h-12 w-full rounded-xl border-border/60 bg-card px-3 data-[size=default]:h-12">
          <SelectValue placeholder="Elige una billetera">
            {selected ? (
              <span className="flex min-w-0 items-center gap-2.5">
                <WalletProviderIcon providerIconKey={selected.providerIconKey} className="size-6" showTooltipLabel={false} />
                <span className="truncate text-sm font-semibold" title={selected.name}>{selected.name}</span>
              </span>
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          {cards.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Tarjetas</SelectLabel>
              {cards.map(item)}
            </SelectGroup>
          ) : null}
          {funding.length > 0 ? (
            <SelectGroup>
              <SelectLabel>Efectivo y débito</SelectLabel>
              {funding.map(item)}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>
      {showInfo && selected ? <p className="mt-1.5 px-1 text-caption text-muted-foreground">{walletInfo(selected)}</p> : null}
    </div>
  );
};

const ChipGroup = <T extends string | number>({
  label,
  options,
  value,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) => (
  <div>
    <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{label}</p>
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={String(o)} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className={cn(chipClass(value === o), 'min-w-12 tabular-nums')}>
          {format(o)}
        </button>
      ))}
    </div>
  </div>
);

const MoneyRow = ({ label, value, onChange, trailing }: { label: string; value: number; onChange: (v: number) => void; trailing?: string }) => {
  const id = useId();
  return (
    <GroupedRow label={label} htmlFor={id} labelWidth="wide">
      <div className="flex items-center gap-2">
        <CurrencyInput id={id} value={value} onChange={onChange} className={cn(OVERLAY_ROW_INPUT_CLASS, 'tabular-nums')} />
        {trailing ? <span className="shrink-0 text-caption text-muted-foreground">{trailing}</span> : null}
      </div>
    </GroupedRow>
  );
};

export type PurchaseFormProps = {
  wallets: SimulationWallet[];
  draft: PurchaseDraft;
  onChange: (patch: Partial<PurchaseDraft>) => void;
  result: PurchaseSimulationResult | null;
  fieldError: { field: string; message: string } | null;
  /** Phone: the button that folds the form and shows the result. */
  onSeeImpact?: () => void;
};

export function payHint(draft: PurchaseDraft, wallets: SimulationWallet[], result: PurchaseSimulationResult | null): string | null {
  const plan = result?.plan;
  if (!plan || !(draft.total > 0)) return null;
  const q = (ymd: string) => {
    const ref = getCalendarFortnightRefForYmd(ymd);
    return quincenaShort(ref);
  };
  const wallet = wallets.find((w) => w.id === draft.walletId);
  if (plan.mode === 'contado') {
    return plan.cutoffDate
      ? `Se carga a tu corte del ${formatDisplayDate(plan.cutoffDate)} y pagas los ${formatMoney(plan.total)} completos el ${formatDisplayDate(plan.firstDueDate)}, en tu ${q(plan.firstDueDate)}. Sin intereses si pagas el total.`
      : `Los ${formatMoney(plan.total)} salen de ${wallet?.name ?? 'tu billetera'} el ${formatDisplayDate(plan.purchaseDate)}.`;
  }
  const payment = formatMoney(plan.regularPayment);
  if (plan.mode === 'msi') {
    return `${plan.count} pagos de ${payment} · total ${formatMoney(plan.total)} · sin intereses. El primero llega en tu pago del ${formatDisplayDate(plan.firstDueDate)} (${q(plan.firstDueDate)}).`;
  }
  const paid = plan.payments.reduce((s, p) => s + p.amount, 0);
  return `${plan.debtWalletId === 'new' ? 'Mensualidad de' : `${plan.count} pagos de`} ${payment}${plan.debtWalletId === 'new' ? ` por ${plan.count} meses desde el ${formatDisplayDate(plan.firstDueDate)}` : ''}. Pagas ${formatMoney(plan.interest)} de intereses: en total ${formatMoney(paid)}.`;
}

export const PurchaseForm = ({ wallets, draft, onChange, result, fieldError, onSeeImpact }: PurchaseFormProps) => {
  const nameId = useId();
  const cards = wallets.filter((w) => w.isCard);
  const funding = wallets.filter((w) => !w.isCard);
  const selected = wallets.find((w) => w.id === draft.walletId) ?? null;
  const modes: { id: PurchaseMode; label: string }[] = [
    { id: 'contado', label: C.modeContado },
    { id: 'msi', label: C.modeMsi },
    { id: 'credito', label: C.modeCredito },
  ];
  const hint = payHint(draft, wallets, result);
  const over = result?.verdict.overLimitBy ?? 0;
  const debtCard = typeof result?.plan.debtWalletId === 'number' ? wallets.find((w) => w.id === result.plan.debtWalletId) : null;
  const shortBy = draft.mode === 'contado' && selected && !selected.isCard ? Math.max(0, draft.total - (selected.balance ?? 0)) : 0;
  const downValue = draft.down ?? Math.round(draft.total * 0.2);
  const isNew = draft.lender === 'new';

  return (
    <section aria-labelledby="sc-form-title" className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'flex flex-col gap-3.5 p-3 sm:p-4')}>
      <SectionHeader id="sc-form-title" icon={ShoppingBag} title={C.formTitle} subtitle={C.formSubtitle} />

      {draft.total <= 0 ? (
        <div>
          <p className="mb-1.5 px-1 eyebrow text-muted-foreground">{C.examples}</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button key={e.label} type="button" onClick={() => onChange(e.patch)} className={cn(chipClass(false), 'min-h-9 rounded-full text-xs')}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={OVERLAY_GROUPED_CARD_CLASS}>
        <GroupedRow label={C.name} htmlFor={nameId}>
          <input id={nameId} value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={C.namePlaceholder} maxLength={120} className={OVERLAY_ROW_INPUT_CLASS} />
        </GroupedRow>
        <AmountRow label={C.total} value={draft.total || ''} onChange={(v) => onChange({ total: v })} ariaLabel="Precio total en pesos" />
        <div className="px-3 py-1.5">
          <DateStepper label={C.date} value={draft.date} onChange={(date) => onChange({ date })} />
        </div>
      </div>
      {fieldError?.field === 'total' || fieldError?.field === 'date' ? <OverlayWarning>{fieldError.message}</OverlayWarning> : null}

      <div>
        <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{C.how}</p>
        <SegmentedControl
          value={draft.mode}
          onValueChange={(mode) => onChange({ mode: mode as PurchaseMode, knownPayment: null })}
          ariaLabel={C.how}
          stretch
          frameClassName={cn(MONTHLY_LIQUID_PANEL_CLASS, 'flex w-full min-w-0 items-center p-1 sm:p-1.5')}
          wrapperClassName="min-w-0 flex-1"
          listClassName="w-full"
          triggerClassName="px-1.5 text-xs leading-tight sm:text-sm"
          indicatorClassName={AURA_TAB_INDICATOR_CLASS}
          activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
          options={modes.map((m) => ({ value: m.id, label: m.label }))}
        />
      </div>

      {draft.mode !== 'credito' ? (
        <WalletSelect
          label={draft.mode === 'msi' ? C.whichCard : C.payWith}
          wallets={draft.mode === 'msi' ? cards : [...cards, ...funding]}
          value={draft.walletId}
          onChange={(walletId) => onChange({ walletId })}
        />
      ) : null}

      {draft.mode === 'msi' ? (
        <ChipGroup label={C.msiMonths} options={MSI_MONTH_OPTIONS} value={draft.months as (typeof MSI_MONTH_OPTIONS)[number]} onChange={(months) => onChange({ months })} />
      ) : null}

      {draft.mode === 'credito' ? (
        <div className="flex flex-col gap-3">
          <ChipGroup<string>
            label={C.lender}
            options={['new', ...cards.map((c) => String(c.id))]}
            value={String(draft.lender)}
            onChange={(v) => onChange({ lender: v === 'new' ? 'new' : Number(v), creditMonths: v === 'new' ? 48 : 12, rate: v === 'new' ? 13.9 : (cards.find((c) => String(c.id) === v)?.aprAnnualPct ?? 40) })}
            format={(v) => (v === 'new' ? C.lenderNew : (cards.find((c) => String(c.id) === v)?.name ?? v))}
          />
          <ChipGroup label={C.term} options={isNew ? NEW_CREDIT_TERMS : CARD_CREDIT_TERMS} value={draft.creditMonths} onChange={(creditMonths) => onChange({ creditMonths })} format={(v) => `${v} m`} />
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            {draft.knownPayment == null ? (
              <GroupedRow label={C.rate} labelWidth="wide">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-bold tabular-nums">{draft.rate.toFixed(1)} %</span>
                  <Button type="button" variant="outline" size="icon" className="size-10 rounded-xl" aria-label={C.rateDown} onClick={() => onChange({ rate: Math.max(0, Math.round((draft.rate - 0.5) * 10) / 10) })}>
                    <Minus className="size-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="size-10 rounded-xl" aria-label={C.rateUp} onClick={() => onChange({ rate: Math.round((draft.rate + 0.5) * 10) / 10 })}>
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </div>
              </GroupedRow>
            ) : (
              <MoneyRow label={C.monthlyPayment} value={draft.knownPayment} onChange={(knownPayment) => onChange({ knownPayment })} />
            )}
            {isNew ? (
              <>
                <MoneyRow label={C.down} value={downValue} onChange={(down) => onChange({ down })} trailing={draft.total > 0 ? `${Math.round((downValue / draft.total) * 100)}%` : undefined} />
                <MoneyRow label={C.extra} value={draft.extra} onChange={(extra) => onChange({ extra })} />
              </>
            ) : null}
          </div>
          {isNew && funding.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <WalletSelect label={C.downFrom} wallets={funding} value={draft.downWalletId} onChange={(downWalletId) => onChange({ downWalletId })} showInfo={false} />
              <WalletSelect label={C.payFrom} wallets={funding} value={draft.payWalletId} onChange={(payWalletId) => onChange({ payWalletId })} showInfo={false} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onChange({ knownPayment: draft.knownPayment == null ? Math.round(result?.plan.regularPayment ?? 0) || 1000 : null })}
            className="self-start px-1 text-xs font-semibold text-primary-text underline underline-offset-4"
          >
            {draft.knownPayment == null ? C.knowPayment : C.useRate}
          </button>
        </div>
      ) : null}

      {hint ? (
        <p role="status" className="flex gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm leading-snug">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{hint}</span>
        </p>
      ) : null}
      {over > 0 && debtCard ? (
        <p role="alert" className="flex gap-2 rounded-xl border border-status-overdue-border bg-status-overdue-soft px-3 py-2.5 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-overdue" aria-hidden />
          <span>Rebasa tu disponible en {debtCard.name} por {formatMoney(over)}. Tu disponible es {formatMoney(debtCard.available ?? 0)}.</span>
        </p>
      ) : null}
      {shortBy > 0 && selected ? (
        <OverlayWarning>Tu saldo en {selected.name} es {formatMoney(selected.balance ?? 0)}: tendrías que pasarle {formatMoney(shortBy)} de otra billetera antes de pagar.</OverlayWarning>
      ) : null}
      {result?.plan.dataGaps.map((g) => (
        <OverlayWarning key={g.walletId}>A {g.walletName} le falta el día de corte o de pago. Mientras tanto suponemos corte el {g.assumedCutoffDay} y pago el {g.assumedDueDay}: las cuotas podrían caer en otra quincena.</OverlayWarning>
      ))}
      {fieldError && fieldError.field !== 'total' && fieldError.field !== 'date' ? <OverlayWarning>{fieldError.message}</OverlayWarning> : null}

      {onSeeImpact ? (
        <Button type="button" className="h-11 w-full rounded-xl md:hidden" onClick={onSeeImpact} disabled={!(draft.total > 0)}>
          {C.seeImpact}
        </Button>
      ) : null}
      <p className="hidden px-1 text-caption text-muted-foreground md:block">{C.updatesLive}</p>
    </section>
  );
};
