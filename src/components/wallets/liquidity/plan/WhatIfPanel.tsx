'use client';

import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { FlaskConical, Minus, Plus } from 'lucide-react';
import { ErrorBanner } from '@/components/error-banner';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDisplayDate } from '@/lib/calendar-dates';
import { cn, formatCurrency } from '@/lib/utils';
import {
  LIQUIDITY_SCENARIO_MAX_MONTHS,
  type LiquidityScenarioItem,
} from '@/schemas/liquidity-scenario.schema';
import { SCENARIO_COPY } from '@/components/wallets/liquidity/scenario/copy';
import { LiquidityScenarioChip } from '@/components/wallets/liquidity/scenario/LiquidityScenarioDeltaStrip';
import { describeScenarioItem } from '@/components/wallets/liquidity/scenario/scenario-format';
import type {
  ScenarioFieldErrors,
  ScenarioFormField,
} from '@/components/wallets/liquidity/use-liquidity-scenario';

export type WhatIfWallet = {
  id: number;
  name: string;
  type: string;
};

const FUNDING_TYPES = new Set(['CASH', 'DEBIT_CARD']);
const CARD_TYPES = new Set(['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']);

export const isWhatIfWalletType = (type: string | undefined): boolean =>
  type != null && (FUNDING_TYPES.has(type) || CARD_TYPES.has(type));

type Kind = LiquidityScenarioItem['kind'];

type WhatIfPanelProps = {
  /** Every wallet of the active context; null while loading. */
  wallets: WhatIfWallet[] | null;
  /** Projection day (today) and horizon end, YYYY-MM-DD. */
  asOf: string;
  until: string;
  /** Scenario on screen, if any. */
  active: LiquidityScenarioItem | null;
  loading: boolean;
  error: string | null;
  fieldErrors: ScenarioFieldErrors;
  /** Desktop note after a run: "Simulado: hueco $A → $B". */
  resultNote?: string | null;
  onSimulate: (item: LiquidityScenarioItem) => Promise<boolean>;
};

const errorId = (base: string, field: ScenarioFormField) => `${base}-${field}-error`;

const validate = (
  draft: { kind: Kind; walletId: number | null; amount: number; date: string; months: number },
  asOf: string,
  until: string,
): ScenarioFieldErrors => {
  const errors: ScenarioFieldErrors = {};
  if (draft.walletId == null) errors.wallet_id = SCENARIO_COPY.errorWallet;
  if (!(draft.amount > 0)) errors.amount = SCENARIO_COPY.errorAmount;
  if (!draft.date) errors.date = SCENARIO_COPY.errorDateMissing;
  else if (draft.date < asOf) errors.date = SCENARIO_COPY.errorDatePast;
  else if (draft.date > until) errors.date = SCENARIO_COPY.errorDateAfter(formatDisplayDate(until));
  if (
    draft.kind === 'instalment' &&
    (!Number.isInteger(draft.months) || draft.months < 1 || draft.months > LIQUIDITY_SCENARIO_MAX_MONTHS)
  ) {
    errors.months = SCENARIO_COPY.errorMonths;
  }
  return errors;
};

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} className="text-xs text-status-overdue">
      {message}
    </p>
  ) : null;

/**
 * "¿Y si…?" card in the Plan tab, right after the hueco. A dated purchase or a
 * monthly payment on a chosen wallet; nothing is stored. After a run it folds
 * to a chip on phones; on desktop the form stays open to adjust and rerun.
 */
export const WhatIfPanel = ({
  wallets,
  asOf,
  until,
  active,
  loading,
  error,
  fieldErrors,
  resultNote,
  onSimulate,
}: WhatIfPanelProps) => {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [folded, setFolded] = useState(false);
  const [kind, setKind] = useState<Kind>(active?.kind ?? 'purchase');
  const [walletId, setWalletId] = useState<number | null>(active?.wallet_id ?? null);
  const [amount, setAmount] = useState(active?.amount ?? 0);
  const [date, setDate] = useState(
    active ? (active.kind === 'purchase' ? active.date : active.firstDate) : '',
  );
  const [months, setMonths] = useState(active?.kind === 'instalment' ? active.months : 6);
  const [touched, setTouched] = useState<Partial<Record<ScenarioFormField, boolean>>>({});

  const wallet = wallets?.find((row) => row.id === walletId) ?? null;
  const funding = (wallets ?? []).filter((row) => FUNDING_TYPES.has(row.type));
  const cards = (wallets ?? []).filter((row) => CARD_TYPES.has(row.type));
  const localErrors = validate({ kind, walletId, amount, date, months }, asOf, until);
  const valid = Object.keys(localErrors).length === 0;
  const shownError = (field: ScenarioFormField) =>
    (touched[field] ? localErrors[field] : undefined) ?? fieldErrors[field];
  const touch = (field: ScenarioFormField) => setTouched((current) => ({ ...current, [field]: true }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ wallet_id: true, amount: true, date: true, months: true });
    if (!valid || walletId == null || loading) return;
    const item: LiquidityScenarioItem =
      kind === 'purchase'
        ? { kind, amount, date, wallet_id: walletId }
        : { kind, amount, firstDate: date, months, wallet_id: walletId };
    const ok = await onSimulate(item);
    if (ok) setFolded(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    // Escape inside the wallet list (a portal) only closes that list.
    if (!event.currentTarget.contains(event.target as Node)) return;
    event.stopPropagation();
    if (active) setFolded(true);
    else setOpen(false);
  };

  const shellClass = cn(MONTHLY_LIQUID_PANEL_CLASS, 'px-4 py-4');
  const header = (subtitle: string) => (
    <div className="flex items-start gap-2">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-[color-mix(in_srgb,var(--chart-2)_70%,white)]" aria-hidden />
      <div className="min-w-0">
        <h3 id={`${baseId}-title`} className="text-sm font-semibold">
          {SCENARIO_COPY.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  if (!open && !active) {
    return (
      <section className={shellClass} aria-labelledby={`${baseId}-title`}>
        {header(SCENARIO_COPY.invite)}
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 w-full rounded-xl sm:w-auto"
          onClick={() => setOpen(true)}
        >
          {SCENARIO_COPY.inviteCta}
        </Button>
      </section>
    );
  }

  const chip =
    active && folded ? (
      <LiquidityScenarioChip
        className="lg:hidden"
        summary={describeScenarioItem(active, wallet?.name ?? SCENARIO_COPY.wallet)}
        actionLabel={SCENARIO_COPY.change}
        onAction={() => setFolded(false)}
      />
    ) : null;

  const dateLabel = kind === 'purchase' ? SCENARIO_COPY.date : SCENARIO_COPY.firstDate;
  const amountLabel = kind === 'purchase' ? SCENARIO_COPY.amount : SCENARIO_COPY.monthlyAmount;
  const isCard = wallet != null && CARD_TYPES.has(wallet.type);
  const walletError = shownError('wallet_id');
  const amountError = shownError('amount');
  const dateError = shownError('date');
  const monthsError = shownError('months');

  return (
    <>
      {chip}
      <section
        className={cn(shellClass, '@container', chip && 'hidden lg:block')}
        aria-labelledby={`${baseId}-title`}
        onKeyDown={handleKeyDown}
      >
        {header(SCENARIO_COPY.formHint)}
        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          <SegmentedControl
            value={kind}
            onValueChange={(next) => setKind(next as Kind)}
            ariaLabel={SCENARIO_COPY.kindLabel}
            stretch
            className="w-full"
            wrapperClassName="min-w-0 flex-1"
            listClassName="w-full"
            options={[
              { value: 'purchase', label: SCENARIO_COPY.purchase },
              { value: 'instalment', label: SCENARIO_COPY.instalment },
            ]}
          />

          <div className="space-y-1.5">
            <Label htmlFor={`${baseId}-wallet`}>{SCENARIO_COPY.wallet}</Label>
            <Select
              value={walletId == null ? '' : String(walletId)}
              onValueChange={(next) => {
                setWalletId(Number(next));
                touch('wallet_id');
              }}
              onOpenChange={(next) => {
                if (!next) touch('wallet_id');
              }}
            >
              <SelectTrigger
                id={`${baseId}-wallet`}
                className="h-11 w-full rounded-xl"
                aria-invalid={walletError ? true : undefined}
                aria-describedby={walletError ? errorId(baseId, 'wallet_id') : undefined}
                disabled={wallets == null}
              >
                <SelectValue placeholder={SCENARIO_COPY.walletPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {funding.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>{SCENARIO_COPY.walletGroupFunding}</SelectLabel>
                    {funding.map((row) => (
                      <SelectItem key={row.id} value={String(row.id)}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {cards.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>{SCENARIO_COPY.walletGroupCards}</SelectLabel>
                    {cards.map((row) => (
                      <SelectItem key={row.id} value={String(row.id)}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
            <FieldError id={errorId(baseId, 'wallet_id')} message={walletError} />
          </div>

          <div className="grid gap-4 @md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-amount`}>{amountLabel}</Label>
              <CurrencyInput
                id={`${baseId}-amount`}
                value={amount}
                onChange={setAmount}
                onBlur={() => touch('amount')}
                className="h-11 rounded-xl"
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? errorId(baseId, 'amount') : undefined}
              />
              <FieldError id={errorId(baseId, 'amount')} message={amountError} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-date`}>{dateLabel}</Label>
              <Input
                id={`${baseId}-date`}
                type="date"
                min={asOf}
                max={until}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                onBlur={() => touch('date')}
                className="h-11 rounded-xl"
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? errorId(baseId, 'date') : undefined}
              />
              <FieldError id={errorId(baseId, 'date')} message={dateError} />
            </div>
          </div>

          {kind === 'instalment' ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${baseId}-months`}>{SCENARIO_COPY.months}</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl"
                  aria-label={SCENARIO_COPY.fewerMonths}
                  disabled={months <= 1}
                  onClick={() => setMonths((value) => Math.max(1, value - 1))}
                >
                  <Minus className="size-4" aria-hidden />
                </Button>
                <Input
                  id={`${baseId}-months`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={String(months)}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value.replace(/\D/g, ''), 10);
                    setMonths(Number.isFinite(next) ? next : 0);
                  }}
                  onBlur={() => touch('months')}
                  className="h-11 w-20 rounded-xl text-center tabular-nums"
                  aria-invalid={monthsError ? true : undefined}
                  aria-describedby={monthsError ? errorId(baseId, 'months') : undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl"
                  aria-label={SCENARIO_COPY.moreMonths}
                  disabled={months >= LIQUIDITY_SCENARIO_MAX_MONTHS}
                  onClick={() => setMonths((value) => Math.min(LIQUIDITY_SCENARIO_MAX_MONTHS, value + 1))}
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
              <FieldError id={errorId(baseId, 'months')} message={monthsError} />
              {amount > 0 && months > 0 ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {months} {months === 1 ? 'pago' : 'pagos'} de {formatCurrency(amount)} · total{' '}
                  {formatCurrency(amount * months)}
                  {isCard && wallet ? ` · cuotas en ${wallet.name}` : ''}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="submit"
              className="h-11 rounded-xl"
              disabled={!valid || loading}
              aria-busy={loading || undefined}
            >
              {loading ? SCENARIO_COPY.simulating : active ? SCENARIO_COPY.resimulate : SCENARIO_COPY.simulate}
            </Button>
            {resultNote && active && !loading ? (
              <p className="hidden text-sm text-muted-foreground lg:block">{resultNote}</p>
            ) : null}
          </div>

          {error ? (
            <ErrorBanner>
              <p className="font-medium">{SCENARIO_COPY.errorTitle}</p>
              <p className="mt-0.5">{error}</p>
            </ErrorBanner>
          ) : null}
        </form>
      </section>
    </>
  );
};
