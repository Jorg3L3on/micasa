'use client';

import { useEffect, useMemo } from 'react';
import { Receipt, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { Money } from '@/components/money';
import { FortnightProgressTrack } from '@/components/monthly/MonthlyChromeHeader';
import {
  MONTHLY_ICON_PILL_CLASS,
  PANEL_INSET_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';
import { ONBOARDING_STEP } from '@/components/onboarding/onboarding-navigation';
import { QuincenaDiagram } from '@/components/onboarding/steps/QuincenaDiagram';
import {
  summaryGroups,
  summaryQuincenaTiles,
  type SummaryGroupKey,
} from '@/components/onboarding/steps/onboarding-summary';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { cn, formatCurrency } from '@/lib/utils';

const GROUP_META: Record<
  SummaryGroupKey,
  { icon: LucideIcon; step: number; editLabel: string }
> = {
  wallets: { icon: Wallet, step: ONBOARDING_STEP.wallets, editLabel: 'Editar billeteras' },
  incomes: { icon: TrendingUp, step: ONBOARDING_STEP.incomes, editLabel: 'Editar ingresos' },
  expenses: { icon: Receipt, step: ONBOARDING_STEP.expenses, editLabel: 'Editar gastos fijos' },
};

const EYEBROW_CLASS =
  'text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground';

const ICON_PILL_CLASS = cn(MONTHLY_ICON_PILL_CLASS, 'size-9');

export default function StepSummary() {
  const {
    setCanProceed,
    wallets,
    incomeTemplates,
    expenseTemplates,
    startDate,
    goToStep,
  } = useOnboarding();

  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  const tiles = useMemo(
    () =>
      summaryQuincenaTiles(
        { wallets, incomeTemplates, expenseTemplates },
        startDate,
        todayCalendarDate(),
      ),
    [wallets, incomeTemplates, expenseTemplates, startDate],
  );
  const groups = useMemo(
    () => summaryGroups({ wallets, incomeTemplates, expenseTemplates }),
    [wallets, incomeTemplates, expenseTemplates],
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-3">
        {tiles.map((tile) => (
          <section
            key={tile.key}
            aria-label={tile.ariaLabel}
            className={cn(PANEL_INSET_CLASS, 'flex flex-[1_1_220px] flex-col gap-2 px-4 py-3.5')}
          >
            <p className={EYEBROW_CLASS}>{tile.title}</p>
            <Money
              value={tile.preview.free}
              tone="neutral"
              className="block font-[family-name:var(--font-display)] text-[28px] font-bold"
            />
            <FortnightProgressTrack
              percent={tile.barPercent}
              tone="complete"
              label={`Gastos fijos de la ${tile.period === 'FIRST' ? '1ª' : '2ª'} quincena`}
            />
            <p className="text-xs leading-[1.45] text-muted-foreground tabular-nums">
              Cobras {formatCurrency(tile.preview.income)} · Pagas{' '}
              {formatCurrency(tile.preview.fixedCosts)}
            </p>
          </section>
        ))}
      </div>

      <ul className={cn(PANEL_INSET_CLASS, 'divide-y divide-border/50 overflow-hidden dark:divide-white/[0.08]')}>
        {groups.map((group) => {
          const meta = GROUP_META[group.key];
          const Icon = meta.icon;
          return (
            <li
              key={group.key}
              className="flex min-h-[60px] items-center gap-3 py-2 pr-1.5 pl-3.5"
            >
              <span className={ICON_PILL_CLASS} aria-hidden>
                <Icon className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{group.title}</p>
                <p className="truncate text-xs leading-[1.45] text-muted-foreground">
                  {group.subtitle}
                </p>
              </div>
              {group.total !== null ? (
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(group.total)}
                  {group.totalSuffix ? (
                    <span className="block text-xs font-normal text-muted-foreground min-[480px]:ml-1 min-[480px]:inline">
                      {group.totalSuffix}
                    </span>
                  ) : null}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={meta.editLabel}
                onClick={() => goToStep(meta.step, { returnHere: true })}
                className="min-h-11 shrink-0 rounded-md px-3 text-[13px] font-medium text-foreground underline underline-offset-[3px] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Editar
              </button>
            </li>
          );
        })}
      </ul>

      <QuincenaDiagram className="min-[781px]:hidden" />
    </div>
  );
}
