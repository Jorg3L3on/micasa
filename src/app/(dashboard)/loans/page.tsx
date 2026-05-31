'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays,
  HandCoins,
  Landmark,
  Loader2,
  Plus,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { createLoan, listLoans } from '@/lib/api/loans';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { PaymentMethodOption, IncomeTemplateListItem } from '@/types/catalog';
import type { CreateLoanInput } from '@/schemas/loan.schema';
import type { LoanListItem } from '@/types/loans';

type LoanFormState = {
  name: string;
  lender: string;
  type: 'PERSONAL' | 'PAYROLL';
  principalAmount: string;
  paymentAmount: string;
  paymentCount: string;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  startDate: string;
  paymentSource: 'WALLET' | 'PAYROLL_DEDUCTION';
  sourceWalletId: string;
  linkedWalletId: string;
  incomeTemplateId: string;
  notes: string;
};

const todayYmd = () => todayCalendarDate();

const defaultForm = (): LoanFormState => ({
  name: '',
  lender: '',
  type: 'PERSONAL',
  principalAmount: '',
  paymentAmount: '',
  paymentCount: '',
  frequency: 'FORTNIGHTLY',
  startDate: todayYmd(),
  paymentSource: 'WALLET',
  sourceWalletId: '',
  linkedWalletId: '',
  incomeTemplateId: '',
  notes: '',
});

const typeLabel = (type: LoanListItem['type']) =>
  type === 'PAYROLL' ? 'Prestamo de nomina' : 'Prestamo personal';

const frequencyLabel = (frequency: LoanListItem['frequency']) => {
  if (frequency === 'WEEKLY') return 'Semanal';
  if (frequency === 'MONTHLY') return 'Mensual';
  return 'Quincenal';
};

const statusLabel = (status: LoanListItem['status']) => {
  if (status === 'PAID_OFF') return 'Pagado';
  if (status === 'PAUSED') return 'Pausado';
  if (status === 'CANCELLED') return 'Cancelado';
  return 'Activo';
};

export default function LoansPage() {
  const { context } = useFinanceContext();
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [wallets, setWallets] = useState<PaymentMethodOption[]>([]);
  const [incomeTemplates, setIncomeTemplates] = useState<IncomeTemplateListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<LoanFormState>(() => defaultForm());

  const fundingWallets = useMemo(
    () =>
      wallets.filter((wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD'),
    [wallets],
  );

  const loadData = useCallback(async () => {
    if (context.type === 'user' && context.id === 0) return;
    setLoading(true);
    try {
      const [loanData, walletData, templateData] = await Promise.all([
        listLoans(context),
        getPaymentMethodOptions(context),
        clientFetchFromApi<IncomeTemplateListItem[]>(
          '/api/income-templates',
          undefined,
          context,
        ),
      ]);
      setLoans(loanData);
      setWallets(walletData);
      setIncomeTemplates(templateData.filter((template) => template.active));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron cargar prestamos',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeLoans = loans.filter((loan) => loan.status === 'ACTIVE');
  const totalDebt = loans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const nextPaymentsTotal = activeLoans.reduce(
    (sum, loan) => sum + (loan.nextPayment?.amount ?? 0),
    0,
  );

  const setField = <K extends keyof LoanFormState>(
    key: K,
    value: LoanFormState[K],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'type' && value === 'PAYROLL') {
        next.paymentSource = 'PAYROLL_DEDUCTION';
        next.sourceWalletId = '';
      }
      if (key === 'type' && value === 'PERSONAL') {
        next.paymentSource = 'WALLET';
        next.incomeTemplateId = '';
      }
      if (key === 'paymentSource' && value === 'PAYROLL_DEDUCTION') {
        next.type = 'PAYROLL';
        next.sourceWalletId = '';
      }
      if (key === 'paymentSource' && value === 'WALLET') {
        next.incomeTemplateId = '';
      }
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload: CreateLoanInput = {
        name: form.name,
        lender: form.lender,
        type: form.type,
        principalAmount: Number(form.principalAmount),
        paymentAmount: Number(form.paymentAmount),
        paymentCount: Number(form.paymentCount),
        frequency: form.frequency,
        startDate: form.startDate,
        paymentSource: form.paymentSource,
        sourceWalletId: form.sourceWalletId ? Number(form.sourceWalletId) : null,
        linkedWalletId: form.linkedWalletId ? Number(form.linkedWalletId) : null,
        incomeTemplateId: form.incomeTemplateId
          ? Number(form.incomeTemplateId)
          : null,
        notes: form.notes || null,
      };
      await createLoan(payload, context);
      toast.success('Prestamo creado');
      setDialogOpen(false);
      setForm(defaultForm());
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo crear el prestamo',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
        <div>
          <h2 className="text-lg font-semibold leading-tight">Prestamos</h2>
          <p className="text-xs text-muted-foreground">
            Prestamos personales y de nomina con calendario de pagos.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo prestamo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Saldo pendiente"
          amount={totalDebt}
          iconKey="circle-dollar"
          iconGradient="linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)"
          subtitle="Capital pendiente"
        />
        <StatCard
          title="Proximos pagos"
          amount={nextPaymentsTotal}
          iconKey="trending-down"
          iconGradient="linear-gradient(135deg, #f97316 0%, #fb923c 100%)"
          subtitle="Siguiente pago por prestamo activo"
        />
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prestamos activos
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {activeLoans.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">En seguimiento</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nomina
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {loans.filter((loan) => loan.type === 'PAYROLL').length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Con deduccion o seguimiento
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cargando prestamos...
          </div>
        ) : loans.length === 0 ? (
          <EmptyState
            message="No tienes prestamos registrados."
            description="Crea un prestamo para ver sus pagos en el panel financiero."
            action={{
              label: 'Crear prestamo',
              onClick: () => setDialogOpen(true),
            }}
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {loans.map((loan) => {
              const Icon = loan.type === 'PAYROLL' ? Landmark : HandCoins;
              return (
                <li
                  key={loan.id}
                  className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-300">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {loan.name}
                        </h3>
                        <Badge
                          variant={loan.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="h-5 text-[10px]"
                        >
                          {statusLabel(loan.status)}
                        </Badge>
                        <Badge variant="outline" className="h-5 text-[10px]">
                          {typeLabel(loan.type)}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{loan.lender}</span>
                        <span>Pago {frequencyLabel(loan.frequency).toLowerCase()}</span>
                        <span>
                          {loan.paymentSource === 'PAYROLL_DEDUCTION'
                            ? `Nomina${loan.incomeTemplateName ? `: ${loan.incomeTemplateName}` : ''}`
                            : loan.sourceWalletName ?? 'Billetera'}
                        </span>
                        {loan.linkedWalletName ? (
                          <span>Reflejado en {loan.linkedWalletName}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4 md:min-w-[30rem]">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Pendiente
                      </p>
                      <p className="font-mono text-sm font-bold tabular-nums">
                        {formatCurrency(loan.remainingAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Pago
                      </p>
                      <p className="font-mono text-sm font-bold tabular-nums">
                        {formatCurrency(loan.paymentAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Pagos
                      </p>
                      <p className="font-mono text-sm font-bold tabular-nums">
                        {loan.paidPayments}/{loan.paymentCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Proximo
                      </p>
                      <p className="inline-flex items-center justify-end gap-1 text-xs font-medium">
                        <CalendarDays className="h-3 w-3" aria-hidden />
                        {loan.nextPayment
                          ? formatDate(loan.nextPayment.dueDate)
                          : 'Sin pagos'}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo prestamo</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="loan-name">Nombre</Label>
                <Input
                  id="loan-name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Prestamo DiDi"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-lender">Entidad</Label>
                <Input
                  id="loan-lender"
                  value={form.lender}
                  onChange={(e) => setField('lender', e.target.value)}
                  placeholder="DiDi, banco, empresa"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setField('type', value as LoanFormState['type'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSONAL">Prestamo personal</SelectItem>
                    <SelectItem value="PAYROLL">Prestamo de nomina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Periodicidad</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(value) =>
                    setField('frequency', value as LoanFormState['frequency'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Quincenal</SelectItem>
                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-principal">Total</Label>
                <Input
                  id="loan-principal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.principalAmount}
                  onChange={(e) => setField('principalAmount', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-payment">Cantidad del pago</Label>
                <Input
                  id="loan-payment"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.paymentAmount}
                  onChange={(e) => setField('paymentAmount', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-count">Numero de pagos</Label>
                <Input
                  id="loan-count"
                  type="number"
                  min="1"
                  step="1"
                  value={form.paymentCount}
                  onChange={(e) => setField('paymentCount', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-start">Primer pago</Label>
                <Input
                  id="loan-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField('startDate', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Forma de pago</Label>
                <Select
                  value={form.paymentSource}
                  onValueChange={(value) =>
                    setField(
                      'paymentSource',
                      value as LoanFormState['paymentSource'],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALLET">Desde billetera</SelectItem>
                    <SelectItem value="PAYROLL_DEDUCTION">
                      Deduccion de nomina
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.paymentSource === 'WALLET' ? (
                <div className="space-y-1.5">
                  <Label>Billetera de pago</Label>
                  <Select
                    value={form.sourceWalletId}
                    onValueChange={(value) => setField('sourceWalletId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona billetera" />
                    </SelectTrigger>
                    <SelectContent>
                      {fundingWallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={String(wallet.id)}>
                          {wallet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Ingreso relacionado</Label>
                  <Select
                    value={form.incomeTemplateId}
                    onValueChange={(value) =>
                      setField('incomeTemplateId', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeTemplates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Reflejar en billetera o cuenta</Label>
                <Select
                  value={form.linkedWalletId || 'none'}
                  onValueChange={(value) =>
                    setField('linkedWalletId', value === 'none' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cuenta vinculada</SelectItem>
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={String(wallet.id)}>
                        {wallet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="loan-notes">Notas</Label>
                <Textarea
                  id="loan-notes"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Condiciones, referencia, comentarios"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  (form.paymentSource === 'WALLET' && !form.sourceWalletId)
                }
                className={cn('gap-2', submitting && 'opacity-80')}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Crear prestamo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
