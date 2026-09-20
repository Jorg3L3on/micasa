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
  type FortnightIncomeDto,
  type IncomeTemplateDto,
} from '@/lib/api/incomes';
import type { WalletListItem } from '@/types/catalog';
import { formatCurrency } from '@/lib/utils';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
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
};

const pickDefaultWallet = (wallets: WalletListItem[]): string => {
  const debit = wallets.find((w) => w.active && w.type === 'DEBIT_CARD');
  if (debit) return String(debit.id);
  const cash = wallets.find((w) => w.active && w.type === 'CASH');
  if (cash) return String(cash.id);
  return '';
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

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      try {
        const [templates, incomes, allWallets] = await Promise.all([
          listIncomeTemplates(context),
          getFortnightIncomes(fortnightId, context),
          clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
        ]);

        const fundingWallets = allWallets.filter(
          (w) => w.active && (w.type === 'DEBIT_CARD' || w.type === 'CASH'),
        );
        setWallets(fundingWallets);

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
            const entryWallet =
              existing?.wallet_id != null
                ? String(existing.wallet_id)
                : defaultWallet;
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

          if (entry.existingIncome) {
            const existingAmount = Number(entry.existingIncome.amount);
            const existingWalletId = entry.existingIncome.wallet_id;
            const sameWalletAndAmount =
              existingWalletId != null &&
              entryWalletId === existingWalletId &&
              amount === existingAmount;
            const shouldForceWalletCredit =
              existingWalletId != null || sameWalletAndAmount;

            await updateIncomeAmount(
              entry.existingIncome.id,
              amount,
              context,
              {
                wallet_id: entryWalletId,
                force_wallet_credit: shouldForceWalletCredit,
                ...(entry.template.categoryId != null
                  ? { category_id: entry.template.categoryId }
                  : {}),
              },
            );
          } else {
            if (entry.template.categoryId == null) {
              throw new Error(
                `La plantilla "${entry.template.name}" no tiene categoría. Edítala en Configuración.`,
              );
            }
            await createIncome(
              {
                fortnight_id: fortnightId,
                amount,
                source: entry.template.source ?? entry.template.name,
                received_at: receivedAt,
                income_template_id: entry.template.id,
                wallet_id: entryWalletId,
                category_id: entry.template.categoryId,
              },
              context,
            );
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
      description={`${periodTitle} — ${periodLabel}. Confirma los montos y la billetera donde se depositó el pago.`}
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
                  </div>
                </div>
              );
            })
          )}

          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              loading || submitting || wallets.length === 0 || !hasEntries
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
