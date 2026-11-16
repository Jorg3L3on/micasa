'use client';

import { useState } from 'react';
import { Bus, House, Receipt, ShoppingCart, Wifi, Zap, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import type {
  ExpenseTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';
import { OnboardingDeletableRow } from '@/components/onboarding/OnboardingDeletableRow';
import {
  flagsFromFrequency,
  frequencyFromFlags,
} from '@/components/onboarding/fortnight-frequency';
import {
  EXPENSE_WHEN_SEGMENTS,
  expenseNeedsDetails,
  presetForExpense,
  type ExpensePresetIcon,
} from '@/components/onboarding/steps/expense-rows';
import type { CategoryOption } from '@/types/catalog';
import { cn } from '@/lib/utils';

const PRESET_ICONS: Record<ExpensePresetIcon, LucideIcon> = {
  home: House,
  cart: ShoppingCart,
  wifi: Wifi,
  bolt: Zap,
  bus: Bus,
};

const ICON_PILL_CLASS =
  'hidden size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18)] md:flex';

const AMOUNT_INPUT_CLASS =
  'h-11 rounded-[10px] border-border/60 bg-white/[0.05] pr-3 text-right text-[15px] font-semibold tabular-nums dark:border-white/10 dark:bg-white/[0.05]';

type ExpenseRowProps = {
  expense: ExpenseTemplateDraft;
  wallets: WalletDraft[];
  categories: CategoryOption[];
  categoriesReady: boolean;
  categoriesLoading: boolean;
  onChange: (patch: Partial<ExpenseTemplateDraft>) => void;
  onDelete: () => void;
};

/**
 * One fixed cost: icon pill, name with "categoría · billetera", a 1ª / 2ª /
 * Ambas toggle and the amount. Tapping the name opens Nombre, Categoría and
 * Billetera inline. Below `md` the toggle wraps under the name and amount.
 */
export function ExpenseRow({
  expense,
  wallets,
  categories,
  categoriesReady,
  categoriesLoading,
  onChange,
  onDelete,
}: ExpenseRowProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsForced = expenseNeedsDetails(expense, categoriesReady);
  const showDetails = detailsOpen || detailsForced;

  const name = expense.name.trim();
  const displayName = name || 'Gasto sin nombre';
  const frequency = frequencyFromFlags(expense);
  const preset = presetForExpense(expense);
  const Icon = preset ? PRESET_ICONS[preset.icon] : Receipt;

  const categoryName =
    categories.find((category) => String(category.id) === expense.categoryId)?.name ??
    (categoriesLoading ? 'Cargando…' : 'Sin categoría');
  const walletName =
    wallets.find((wallet) => wallet.id === expense.walletId)?.name.trim() ||
    'Sin billetera';

  const amountId = `expense-amount-${expense.id}`;
  const detailsId = `expense-details-${expense.id}`;
  const nameId = `expense-name-${expense.id}`;
  const categoryFieldId = `expense-category-${expense.id}`;
  const walletFieldId = `expense-wallet-${expense.id}`;

  return (
    <li>
      <OnboardingDeletableRow
        name={expense.name}
        canDelete
        itemNoun="gasto"
        onDelete={onDelete}
        className="rounded-none"
      >
        {(deleteButton) => (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 md:flex-nowrap md:px-3.5">
            <span className={cn(ICON_PILL_CLASS, 'order-1')} aria-hidden>
              <Icon className="size-[18px]" />
            </span>
            <button
              type="button"
              aria-expanded={showDetails}
              aria-controls={detailsId}
              onClick={() => {
                if (!detailsForced) setDetailsOpen((open) => !open);
              }}
              className="order-1 min-h-11 min-w-0 flex-1 basis-32 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="block truncate text-[15px] font-semibold text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-xs leading-[1.45] text-muted-foreground">
                {categoryName} · {walletName}
              </span>
            </button>
            <div className="order-3 basis-full md:order-2 md:basis-auto">
            <div
              role="group"
              aria-label={`Quincena en que se paga ${displayName}`}
              className="inline-flex shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] p-0.5"
            >
              {EXPENSE_WHEN_SEGMENTS.map((segment) => {
                const on = frequency === segment.value;
                return (
                  <button
                    key={segment.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      onChange({ isRecurring: true, ...flagsFromFrequency(segment.value) })
                    }
                    className={cn(
                      'min-h-10 min-w-12 rounded-[10px] px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                      on
                        ? 'bg-white/[0.12] font-semibold text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.2)]'
                        : 'font-medium text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {segment.label}
                  </button>
                );
              })}
            </div>
            </div>
            <div className="order-2 flex w-28 shrink-0 md:order-3 md:w-[120px]">
              <CurrencyInput
                id={amountId}
                grouped
                value={expense.amount || ''}
                onChange={(value) => onChange({ amount: Number.isFinite(value) ? value : 0 })}
                placeholder="0.00"
                aria-label={`Monto de ${displayName}`}
                aria-invalid={!(expense.amount > 0) || undefined}
                className={AMOUNT_INPUT_CLASS}
              />
            </div>
            {deleteButton ? <div className="order-4 hidden md:block">{deleteButton}</div> : null}

            {showDetails ? (
              <div id={detailsId} className={cn(OVERLAY_GROUPED_CARD_CLASS, 'order-5 basis-full')}>
                <GroupedRow label="Nombre" htmlFor={nameId}>
                  <Input
                    id={nameId}
                    value={expense.name}
                    onChange={(event) => onChange({ name: event.target.value })}
                    placeholder="Ej. Colegiatura"
                    autoComplete="off"
                    aria-invalid={name === '' || undefined}
                    className={OVERLAY_ROW_INPUT_CLASS}
                  />
                </GroupedRow>
                <GroupedRow label="Categoría" htmlFor={categoryFieldId}>
                  <CategoryGroupedSelect
                    categories={categories}
                    value={
                      expense.categoryId ? Number.parseInt(expense.categoryId, 10) : undefined
                    }
                    onValueChange={(id) => onChange({ categoryId: String(id) })}
                    disabled={!categoriesReady}
                    placeholder={categoriesLoading ? 'Cargando…' : 'Elige una categoría'}
                    ariaLabel="Categoría del gasto"
                    triggerId={categoryFieldId}
                    triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
                  />
                </GroupedRow>
                <GroupedRow label="Billetera" htmlFor={walletFieldId}>
                  <Select
                    value={expense.walletId}
                    onValueChange={(value) => onChange({ walletId: value })}
                  >
                    <SelectTrigger id={walletFieldId} className={OVERLAY_ROW_TRIGGER_CLASS}>
                      <SelectValue placeholder="Con qué pagas" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          {wallet.name.trim() || 'Billetera sin nombre'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </GroupedRow>
              </div>
            ) : null}
          </div>
        )}
      </OnboardingDeletableRow>
    </li>
  );
}
