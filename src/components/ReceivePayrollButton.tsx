'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinanceContext } from '@/context/finance-context';
import {
  listIncomeTemplates,
  getFortnightIncomes,
  createIncome,
  updateIncomeAmount,
  clientFetchFromApi,
  type IncomeTemplateDto,
  type FortnightIncomeDto,
} from '@/lib/api';
import type { WalletListItem } from '@/types/catalog';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';

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
  amount: string;
  walletId: string;
  forceWalletCredit: boolean;
};

function pickDefaultWallet(wallets: WalletListItem[]): string {
  // Prefer first active DEBIT_CARD, then first active CASH — never credit cards
  const debit = wallets.find((w) => w.active && w.type === 'DEBIT_CARD');
  if (debit) return String(debit.id);
  const cash = wallets.find((w) => w.active && w.type === 'CASH');
  if (cash) return String(cash.id);
  return '';
}

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

        // Only cash/debit wallets can receive income
        const fundingWallets = allWallets.filter(
          (w) => w.active && (w.type === 'DEBIT_CARD' || w.type === 'CASH'),
        );
        setWallets(fundingWallets);

        const defaultWallet = pickDefaultWallet(fundingWallets);

        const applicable = templates.filter((t) => {
          if (!t.active) return false;
          return period === 'FIRST' ? t.appliesFirstFortnight : t.appliesSecondFortnight;
        });

        setEntries(
          applicable.map((t) => {
            const existing = incomes.find((i) => i.income_template_id === t.id) ?? null;
            // Per-entry wallet: use the one already on the income record, else fall back to default
            const entryWallet = existing?.wallet_id != null
              ? String(existing.wallet_id)
              : defaultWallet;
            return {
              template: t,
              existingIncome: existing,
              amount:
                existing != null
                  ? String(existing.amount)
                  : t.suggestedAmount != null
                    ? String(t.suggestedAmount)
                    : '',
              walletId: entryWallet,
              forceWalletCredit: existing?.wallet_id != null,
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

  const handleAmountChange = (templateId: number, value: string) => {
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

  const handleForceWalletCreditChange = (templateId: number, checked: boolean) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.template.id === templateId ? { ...e, forceWalletCredit: checked } : e,
      ),
    );
  };

  const handleSubmit = async () => {
    // Validate amounts and wallets
    for (const entry of entries) {
      const raw = entry.amount.trim().replace(',', '.');
      if (raw === '') continue;
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`Monto inválido en "${entry.template.name}"`);
        return;
      }
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
          const raw = entry.amount.trim().replace(',', '.');
          if (raw === '') return;
          const amount = parseFloat(raw);
          if (!Number.isFinite(amount) || amount <= 0) return;

          const entryWalletId = entry.walletId ? parseInt(entry.walletId, 10) : null;

          if (entry.existingIncome) {
            const existingAmount = Number(entry.existingIncome.amount);
            const existingWalletId = entry.existingIncome.wallet_id;
            const sameWalletAndAmount =
              existingWalletId != null &&
              entryWalletId === existingWalletId &&
              amount === existingAmount;
            const shouldForceWalletCredit =
              entry.forceWalletCredit || sameWalletAndAmount;

            await updateIncomeAmount(
              entry.existingIncome.id,
              amount,
              context,
              {
                wallet_id: entryWalletId,
                force_wallet_credit: shouldForceWalletCredit,
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
      toast.error(err instanceof Error ? err.message : 'Error al guardar ingresos');
    } finally {
      setSubmitting(false);
    }
  };

  const hasEntries = entries.length > 0;
  const periodLabel = period === 'FIRST' ? 'días 1–15' : 'días 16–fin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recibir quincena</DialogTitle>
          <DialogDescription>
            {period === 'FIRST' ? 'Primera quincena' : 'Segunda quincena'} — {periodLabel}. Confirma los montos y la billetera donde se depositó el pago.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {wallets.length === 0 ? (
              <p className="text-sm text-destructive">
                No hay billeteras de débito o efectivo disponibles.
              </p>
            ) : !hasEntries ? (
              <p className="text-center text-sm text-muted-foreground">
                No hay plantillas de ingresos configuradas para esta quincena.
              </p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.template.id}
                  className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-sm font-medium">{entry.template.name}</span>
                    {entry.template.source ? (
                      <span className="text-[10px] text-muted-foreground">
                        {entry.template.source}
                      </span>
                    ) : null}
                    {entry.existingIncome ? (
                      <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                        actualizar
                      </span>
                    ) : null}
                  </div>

                  {/* Amount */}
                  <div className="space-y-1">
                    <Label
                      htmlFor={`income-amount-${entry.template.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Monto
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        id={`income-amount-${entry.template.id}`}
                        type="text"
                        inputMode="decimal"
                        className="pl-7 font-mono"
                        value={entry.amount}
                        onChange={(e) =>
                          handleAmountChange(entry.template.id, e.target.value)
                        }
                      />
                    </div>
                  </div>

                  {/* Per-entry wallet */}
                  <div className="space-y-1">
                    <Label
                      htmlFor={`income-wallet-${entry.template.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Depositar en
                    </Label>
                    <Select
                      value={entry.walletId}
                      onValueChange={(v) => handleWalletChange(entry.template.id, v)}
                    >
                      <SelectTrigger
                        id={`income-wallet-${entry.template.id}`}
                        className="w-full"
                      >
                        <SelectValue placeholder="Selecciona una billetera" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            <span className="flex items-center gap-2">
                              <WalletIdentity
                                name={w.name}
                                providerIconKey={w.provider_icon_key}
                                iconClassName="h-5 w-5 rounded-md"
                              />
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                {w.type === 'CASH' ? 'Efectivo' : 'Débito'}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {entry.existingIncome?.wallet_id != null ? (
                    <label
                      htmlFor={`income-force-credit-${entry.template.id}`}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2"
                    >
                      <Checkbox
                        id={`income-force-credit-${entry.template.id}`}
                        checked={entry.forceWalletCredit}
                        onCheckedChange={(checked) =>
                          handleForceWalletCreditChange(
                            entry.template.id,
                            checked === true,
                          )
                        }
                      />
                      <span className="space-y-0.5">
                        <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Forzar abono en billetera
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          Activo por defecto para reparar quincenas donde el ingreso ya tenía billetera pero no subió el saldo.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitting || wallets.length === 0 || !hasEntries}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Standalone trigger (for the fortnight detail page) ──────────────────────

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
        <Banknote className="h-4 w-4" />
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
