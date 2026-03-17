'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  Receipt,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import {
  clientFetchFromApi,
  createCreditCardPayment,
  getCreditCardStatement,
  getPaymentMethodOptions,
} from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type {
  CreditCardListItem,
  CreditCardStatementResponse,
  PaymentMethodOption,
} from '@/types/catalog';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const shiftDateByDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

const formatCycleRange = (start: string, end: string) =>
  `${formatDate(start)} – ${formatDate(end)}`;

export default function CreditCardDetailPage() {
  const params = useParams<{ id: string }>();
  const { context } = useFinanceContext();
  const creditCardId = Number(params.id);

  const [card, setCard] = useState<CreditCardListItem | null>(null);
  const [statement, setStatement] =
    useState<CreditCardStatementResponse | null>(null);
  const [paymentSources, setPaymentSources] = useState<PaymentMethodOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [asOfDate, setAsOfDate] = useState(getTodayDateString());
  const [paymentForm, setPaymentForm] = useState({
    source_wallet_id: '',
    amount: '',
    paid_at: getTodayDateString(),
    note: '',
  });

  const fundingWalletOptions = useMemo(
    () =>
      paymentSources.filter(
        (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
      ),
    [paymentSources],
  );

  const loadData = useCallback(async () => {
    if (!Number.isFinite(creditCardId)) {
      setError('Tarjeta inválida');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [cardData, statementData, paymentMethodsData] = await Promise.all([
        clientFetchFromApi<CreditCardListItem>(
          `/api/credit-cards/${creditCardId}`,
          undefined,
          context,
        ),
        getCreditCardStatement(creditCardId, context, asOfDate),
        getPaymentMethodOptions(context),
      ]);

      setCard(cardData);
      setStatement(statementData);
      setPaymentSources(paymentMethodsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar el estado de cuenta',
      );
    } finally {
      setLoading(false);
    }
  }, [asOfDate, context, creditCardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePaymentSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    try {
      setPaymentSubmitting(true);
      setPaymentError(null);

      await createCreditCardPayment(
        creditCardId,
        {
          source_wallet_id: Number(paymentForm.source_wallet_id),
          amount: Number(paymentForm.amount),
          paid_at: `${paymentForm.paid_at}T12:00:00.000Z`,
          note: paymentForm.note.trim() || null,
        },
        context,
      );

      toast.success('Pago registrado');
      setPaymentDialogOpen(false);
      setPaymentForm({
        source_wallet_id: '',
        amount: '',
        paid_at: getTodayDateString(),
        note: '',
      });
      await loadData();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Error al registrar el pago',
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const isCurrentCycle = useMemo(() => {
    if (!statement) return true;
    const today = getTodayDateString();
    return today >= statement.current_cycle_start && today <= statement.current_cycle_end;
  }, [statement]);

  const handlePreviousCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.statement_start, -1));
  }, [statement]);

  const handleNextCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.current_cycle_end, 1));
  }, [statement]);

  const handleResetToToday = useCallback(() => {
    setAsOfDate(getTodayDateString());
  }, []);

  if (loading && !statement) {
    return (
      <div className="py-8 text-center text-muted-foreground">Cargando...</div>
    );
  }

  if (error || !card || !statement) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/wallets">
            <ArrowLeft className="h-4 w-4" />
            Volver a billeteras
          </Link>
        </Button>
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error ?? 'No se pudo cargar la tarjeta'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/wallets" aria-label="Volver a billeteras">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{card.name}</h1>
            <p className="text-xs text-muted-foreground">
              Corte día {card.cutoff_day} · Pago día {card.due_day}
            </p>
          </div>
        </div>

        <Button onClick={() => setPaymentDialogOpen(true)}>
          <Wallet className="h-4 w-4" />
          Registrar pago
        </Button>
      </div>

      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousCycle}
          aria-label="Ciclo anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ciclo actual
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCycleRange(statement.current_cycle_start, statement.current_cycle_end)}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextCycle}
          disabled={isCurrentCycle}
          aria-label="Ciclo siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentCycle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToToday}
            aria-label="Volver al ciclo actual"
            className="ml-1 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Hoy
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-l-[3px] border-l-violet-500/50 bg-violet-500/5 px-3 py-3 dark:bg-violet-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Deuda actual
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {formatCurrency(statement.outstanding_balance)}
          </p>
        </div>
        <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 px-3 py-3 dark:bg-emerald-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Crédito disponible
          </p>
          <p
            className={cn(
              'text-2xl font-bold font-mono tabular-nums',
              (statement.available_credit ?? 0) < 0 && 'text-destructive',
            )}
          >
            {statement.available_credit == null
              ? 'Sin línea'
              : formatCurrency(statement.available_credit)}
          </p>
        </div>
        <div className="rounded-lg border border-l-[3px] border-l-amber-500/50 bg-amber-500/5 px-3 py-3 dark:bg-amber-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pago próximo
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {formatCurrency(statement.next_due_payment)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Vence el {formatDate(statement.statement_due_date)}
          </p>
        </div>
        <div className="rounded-lg border border-l-[3px] border-l-blue-500/50 bg-blue-500/5 px-3 py-3 dark:bg-blue-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Compras del ciclo
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {formatCurrency(statement.current_cycle_purchases)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Pagos del ciclo {formatCurrency(statement.current_cycle_payments)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden border-border/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Resumen del estado de cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Receipt className="mt-0.5 h-4 w-4 text-violet-500" />
              <div>
                <p className="text-muted-foreground">Periodo facturado</p>
                <p>
                  {formatDate(statement.statement_start)} al{' '}
                  {formatDate(statement.statement_end)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Landmark className="mt-0.5 h-4 w-4 text-blue-500" />
              <div>
                <p className="text-muted-foreground">Saldo del corte</p>
                <p className="font-mono tabular-nums">
                  {formatCurrency(statement.last_statement_balance)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Pagos desde el corte</p>
              <p className="font-mono tabular-nums">
                {formatCurrency(statement.payments_since_last_cutoff)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pagos aplicados al corte</p>
              <p className="font-mono tabular-nums">
                {formatCurrency(statement.payments_applied_to_statement)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Compras del ciclo actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statement.current_cycle_purchase_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay compras registradas en el ciclo actual. Las compras se
                registran desde el flujo normal de gastos seleccionando esta
                tarjeta como método de pago.
              </p>
            ) : (
              statement.current_cycle_purchase_items.map((purchase) => (
                <div
                  key={purchase.id}
                  className="rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{purchase.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {purchase.category} ·{' '}
                        {formatDate(purchase.payment_date)}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-bold">
                      {formatCurrency(purchase.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Compras del último corte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statement.statement_purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hubo compras en el último corte.
              </p>
            ) : (
              statement.statement_purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{purchase.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {purchase.category} ·{' '}
                        {formatDate(purchase.payment_date)}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-bold">
                      {formatCurrency(purchase.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Historial de pagos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statement.payment_history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay pagos registrados.
              </p>
            ) : (
              statement.payment_history.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        Desde {payment.source_wallet_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(payment.paid_at)}
                        {payment.note ? ` · ${payment.note}` : ''}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              Transfiere saldo desde una billetera de efectivo o débito hacia
              esta tarjeta.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            {paymentError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {paymentError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Billetera origen</label>
              <select
                value={paymentForm.source_wallet_id}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    source_wallet_id: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                aria-label="Selecciona la billetera origen"
              >
                <option value="">Selecciona una billetera</option>
                {fundingWalletOptions.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  aria-label="Monto del pago"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de pago</label>
                <Input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      paid_at: event.target.value,
                    }))
                  }
                  aria-label="Fecha del pago"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nota</label>
              <Input
                value={paymentForm.note}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                aria-label="Nota del pago"
                placeholder="Opcional"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={paymentSubmitting}>
                {paymentSubmitting ? 'Guardando...' : 'Registrar pago'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
