'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  createIncome,
  getFortnightIncomes,
  listIncomeTemplates,
  updateIncomeAmount,
  updateIncomeTemplate,
  type FortnightIncomeDto,
  type IncomeTemplateDto,
} from '@/lib/api/incomes';
import type { CategoryOption, WalletListItem } from '@/types/catalog';
import { formatCurrency } from '@/lib/utils';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fortnightId: number;
  period: 'FIRST' | 'SECOND';
  year: number;
  month: number;
  onSuccess?: () => Promise<void>;
};

type TemplateEntry = {
  template: IncomeTemplateDto;
  existingIncome: FortnightIncomeDto | null;
  amount: number;
  walletId: string;
  categoryId: string;
};

const pickDefaultWallet = (wallets: WalletListItem[]): string => {
  const debit = wallets.find((w) => w.active && w.type === 'DEBIT_CARD');
  if (debit) return String(debit.id);
  const cash = wallets.find((w) => w.active && w.type === 'CASH');
  if (cash) return String(cash.id);
  return '';
};

const pickDefaultIncomeCategoryId = ({
  existingCategoryId,
  templateCategoryId,
  categories,
}: {
  existingCategoryId: number | null | undefined;
  templateCategoryId: number | null | undefined;
  categories: CategoryOption[];
}): number | null => {
  const ids = new Set(categories.map((category) => category.id));
  if (existingCategoryId != null && ids.has(existingCategoryId)) {
    return existingCategoryId;
  }
  if (templateCategoryId != null && ids.has(templateCategoryId)) {
    return templateCategoryId;
  }
  const salario = categories.find(
    (category) =>
      category.active !== false &&
      category.name.trim().toLowerCase() === 'salario',
  );
  if (salario) return salario.id;
  const firstActive = categories.find((category) => category.active !== false);
  return firstActive?.id ?? categories[0]?.id ?? null;
};

export function ReceivePayrollButton({
  open,
  onOpenChange,
  fortnightId,
  period,
  year,
  month,
  onSuccess,
}: Props) {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      try {
        const [templates, incomes, allWallets, incomeCategories] =
          await Promise.all([
            listIncomeTemplates(context),
            getFortnightIncomes(fortnightId, context),
            clientFetchFromApi<WalletListItem[]>(
              '/api/wallets',
              undefined,
              context,
            ),
            clientFetchFromApi<CategoryOption[]>(
              '/api/categories?kind=income',
              undefined,
              context,
            ),
          ]);

        const fundingWallets = allWallets.filter(
          (w) => w.active && (w.type === 'DEBIT_CARD' || w.type === 'CASH'),
        );
        setWallets(fundingWallets);
        setCategories(incomeCategories);

        const defaultWallet = pickDefaultWallet(fundingWallets);

        const applicable = templates.filter((t) => {
          if (!t.active) return false;
          return period === 'FIRST'
            ? t.appliesFirstFortnight
            : t.appliesSecondFortnight;
        });

        setEntries(
          applicable.map((t) => {
            const existing =
              incomes.find((i) => i.income_template_id === t.id) ?? null;
            const notYetCredited = existing?.wallet_credited !== true;
            const entryWallet =
              notYetCredited && t.walletId != null
                ? String(t.walletId)
                : existing?.wallet_id != null
                  ? String(existing.wallet_id)
                  : t.walletId != null
                    ? String(t.walletId)
                    : defaultWallet;
            const defaultCategoryId = pickDefaultIncomeCategoryId({
              existingCategoryId: existing?.category_id,
              templateCategoryId: t.categoryId,
              categories: incomeCategories,
            });
            return {
              template: t,
              existingIncome: existing,
              amount:
                existing != null
                  ? Number(existing.amount) || 0
                  : t.suggestedAmount != null
                    ? Number(t.suggestedAmount) || 0
                    : 0,
              walletId: entryWallet,
              categoryId:
                defaultCategoryId != null ? String(defaultCategoryId) : '',
            };
          }),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al cargar datos');
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open, fortnightId, period, context, onOpenChange]);

  const handleAmountChange = (templateId: number, value: number) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.template.id === templateId ? { ...e, amount: value } : e,
      ),
    );
  };

  const handleWalletChange = (templateId: number, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.template.id === templateId ? { ...e, walletId: value } : e,
      ),
    );
  };

  const handleCategoryChange = (templateId: number, value: number) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.template.id === templateId
          ? { ...e, categoryId: String(value) }
          : e,
      ),
    );
  };

  const handleSubmit = async () => {
    for (const entry of entries) {
      if (!Number.isFinite(entry.amount) || entry.amount < 0) {
        toast.error(`Monto inválido en "${entry.template.name}"`);
        return;
      }
      if (entry.amount <= 0) continue;
      if (!entry.walletId) {
        toast.error(`Selecciona una billetera para "${entry.template.name}"`);
        return;
      }
      if (!entry.categoryId) {
        toast.error(`Selecciona una categoría para "${entry.template.name}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const day = period === 'FIRST' ? '01' : '16';
      const receivedAt = `${year}-${String(month).padStart(2, '0')}-${day}`;

      await Promise.all(
        entries.map(async (entry) => {
          const amount = entry.amount;
          if (!Number.isFinite(amount) || amount <= 0) return;

          const entryWalletId = parseInt(entry.walletId, 10);
          const entryCategoryId = parseInt(entry.categoryId, 10);

          if (entry.existingIncome) {
            await updateIncomeAmount(
              entry.existingIncome.id,
              amount,
              context,
              {
                wallet_id: entryWalletId,
                category_id: entryCategoryId,
              },
            );
          } else {
            await createIncome(
              {
                fortnight_id: fortnightId,
                amount,
                source: entry.template.source ?? entry.template.name,
                received_at: receivedAt,
                income_template_id: entry.template.id,
                wallet_id: entryWalletId,
                category_id: entryCategoryId,
              },
              context,
            );
          }

          if (entry.template.categoryId == null) {
            try {
              await updateIncomeTemplate(
                entry.template.id,
                { categoryId: entryCategoryId },
                context,
              );
            } catch {
              // Income already saved; template can be fixed later in settings.
            }
          }
        }),
      );

      toast.success('Ingresos registrados y billetera actualizada');
      onOpenChange(false);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al guardar ingresos',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasEntries = entries.length > 0;
  const periodLabel =
    period === 'FIRST'
      ? 'último día del mes anterior al 14'
      : 'del 15 al penúltimo día';
  const periodTitle =
    period === 'FIRST' ? 'Primera quincena' : 'Segunda quincena';

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Recibir quincena"
      description={`${periodTitle} — ${periodLabel}. El monto se suma a la billetera de la plantilla.`}
      busy={submitting}
    >
      {({ handleSelectOpenChange }) => (
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2
                className="h-6 w-6 animate-spin text-muted-foreground"
                data-icon="inline-start"
              />
            </div>
          ) : wallets.length === 0 ? (
            <p className="text-sm text-destructive">
              No hay billeteras de débito o efectivo disponibles.
            </p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-destructive">
              No hay categorías de ingreso. Crea una en Configuración.
            </p>
          ) : !hasEntries ? (
            <p className="text-center text-sm text-muted-foreground">
              No hay plantillas de ingresos configuradas para esta quincena.
            </p>
          ) : (
            entries.map((entry) => {
              const selectedWallet = wallets.find(
                (w) => String(w.id) === entry.walletId,
              );
              return (
                <div key={entry.template.id} className="flex flex-col gap-2">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {entry.template.name}
                  </p>
                  <div className={OVERLAY_GROUPED_CARD_CLASS}>
                    <AmountRow
                      id={`income-amount-${entry.template.id}`}
                      value={entry.amount}
                      onChange={(value) =>
                        handleAmountChange(entry.template.id, value)
                      }
                      ariaLabel={`Monto de ${entry.template.name}`}
                    />
                    <GroupedRow label="Billetera">
                      <Select
                        value={entry.walletId || undefined}
                        onOpenChange={handleSelectOpenChange}
                        onValueChange={(value) =>
                          handleWalletChange(entry.template.id, value)
                        }
                      >
                        <SelectTrigger
                          id={`income-wallet-${entry.template.id}`}
                          className={OVERLAY_ROW_TRIGGER_CLASS}
                          aria-label={`Billetera para ${entry.template.name}`}
                        >
                          <SelectValue placeholder="Selecciona">
                            {selectedWallet ? (
                              <WalletIdentity
                                name={selectedWallet.name}
                                providerIconKey={
                                  selectedWallet.provider_icon_key
                                }
                                iconClassName="h-8 w-8 rounded-lg"
                              />
                            ) : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {wallets.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                              <span className="flex items-center justify-between gap-3">
                                <WalletIdentity
                                  name={w.name}
                                  providerIconKey={w.provider_icon_key}
                                  iconClassName="h-5 w-5 rounded-md"
                                />
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                  {formatCurrency(w.amount ?? 0)}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </GroupedRow>
                    <GroupedRow label="Categoría">
                      <CategoryGroupedSelect
                        categories={categories}
                        value={
                          entry.categoryId
                            ? Number(entry.categoryId)
                            : undefined
                        }
                        onValueChange={(id) =>
                          handleCategoryChange(entry.template.id, id)
                        }
                        onOpenChange={handleSelectOpenChange}
                        placeholder="Selecciona"
                        ariaLabel={`Categoría para ${entry.template.name}`}
                        triggerId={`income-category-${entry.template.id}`}
                        triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
                      />
                    </GroupedRow>
                  </div>
                </div>
              );
            })
          )}

          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              loading ||
              submitting ||
              wallets.length === 0 ||
              categories.length === 0 ||
              !hasEntries
            }
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </ResponsiveOverlay>
  );
}

type TriggerProps = Omit<Props, 'open' | 'onOpenChange'>;

export function ReceivePayrollTrigger(props: TriggerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSuccess = useCallback(async () => {
    if (props.onSuccess) {
      await props.onSuccess();
    } else {
      router.refresh();
    }
  }, [props, router]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Banknote className="h-4 w-4" data-icon="inline-start" />
        Recibir quincena
      </Button>
      <ReceivePayrollButton
        {...props}
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
