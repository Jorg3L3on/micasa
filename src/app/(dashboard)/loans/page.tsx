'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  Clock,
  Eye,
  HandCoins,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  Undo2,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { applyLoanPaymentAction, createLoan, listLoans } from '@/lib/api/loans';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import type { PaymentMethodOption, IncomeTemplateListItem } from '@/types/catalog';
import type { CreateLoanInput } from '@/schemas/loan.schema';
import type {
  LoanListItem,
  LoanPaymentActionValue,
  LoanPaymentListItem,
} from '@/types/loans';

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

type LoanStatusFilter = LoanListItem['status'] | 'ALL';
type LoanPaymentVisualStatus =
  | 'scheduled'
  | 'paid'
  | 'skipped'
  | 'cancelled'
  | 'overdue';
type PaymentActionDraft = {
  paymentId: number;
  action: LoanPaymentActionValue;
  paidAt: string;
  sourceWalletId: string;
  note: string;
};
type PaymentActionErrors = Partial<
  Record<'paidAt' | 'sourceWalletId' | 'note' | 'general', string>
>;

const defaultStartDate = () => todayCalendarDate();

const defaultForm = (): LoanFormState => ({
  name: '',
  lender: '',
  type: 'PERSONAL',
  principalAmount: '',
  paymentAmount: '',
  paymentCount: '',
  frequency: 'FORTNIGHTLY',
  startDate: defaultStartDate(),
  paymentSource: 'WALLET',
  sourceWalletId: '',
  linkedWalletId: '',
  incomeTemplateId: '',
  notes: '',
});

const typeLabel = (type: LoanListItem['type']) =>
  type === 'PAYROLL' ? 'Préstamo de nómina' : 'Préstamo personal';

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

const paymentStatusLabel = (status: LoanPaymentVisualStatus) => {
  if (status === 'paid') return 'Pagado';
  if (status === 'skipped') return 'Omitido';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'overdue') return 'Vencido';
  return 'Por pagar';
};

const paymentActionLabel = (action: LoanPaymentActionValue) => {
  if (action === 'MARK_PAID') return 'Confirmar pago';
  if (action === 'MARK_SCHEDULED') return 'Deshacer pago';
  if (action === 'SKIP') return 'Omitir pago';
  return 'Cancelar pago';
};

const paymentActionDescription = (
  action: LoanPaymentActionValue,
  paymentSource: LoanListItem['paymentSource'],
) => {
  if (action === 'MARK_PAID') {
    return paymentSource === 'PAYROLL_DEDUCTION'
      ? 'Se marcará como pagado sin generar salida de billetera porque es deducción de nómina.'
      : 'Se marcará como pagado y se generará el gasto vinculado contra la billetera seleccionada.';
  }
  if (action === 'MARK_SCHEDULED') {
    return 'Se regresará el pago a por pagar y se revertirá el gasto vinculado o el movimiento de billetera asociado.';
  }
  if (action === 'SKIP') {
    return 'Omitir mantiene el adeudo pendiente para seguimiento y no genera salida de dinero.';
  }
  return 'Cancelar excluye este pago del calendario pagadero y no genera salida de dinero.';
};

const mapPaymentActionError = (message: string): PaymentActionErrors => {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('billetera') ||
    normalized.includes('saldo insuficiente') ||
    normalized.includes('débito') ||
    normalized.includes('debito') ||
    normalized.includes('efectivo')
  ) {
    return { sourceWalletId: message };
  }
  if (normalized.includes('fecha')) {
    return { paidAt: message };
  }
  return { general: message };
};

const getPaymentVisualStatus = (
  payment: LoanPaymentListItem,
  todayYmd: string,
): LoanPaymentVisualStatus => {
  if (payment.status === 'PAID') return 'paid';
  if (payment.status === 'SKIPPED') return 'skipped';
  if (payment.status === 'CANCELLED') return 'cancelled';
  if (payment.dueDate < todayYmd) return 'overdue';
  return 'scheduled';
};

const paymentStatusTone = (status: LoanPaymentVisualStatus) => {
  if (status === 'paid') {
    return {
      icon: CheckCircle2,
      row: 'border-emerald-500/25 border-l-emerald-500 bg-emerald-500/5',
      badge:
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      iconBox:
        'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300',
    };
  }
  if (status === 'overdue') {
    return {
      icon: AlertTriangle,
      row: 'border-destructive/30 border-l-destructive bg-destructive/5',
      badge: 'border-destructive/40 bg-destructive/10 text-destructive',
      iconBox: 'bg-destructive/10 text-destructive ring-destructive/30',
    };
  }
  if (status === 'skipped') {
    return {
      icon: CircleSlash,
      row: 'border-slate-400/25 border-l-slate-400 bg-slate-500/5',
      badge:
        'border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
      iconBox:
        'bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-300',
    };
  }
  if (status === 'cancelled') {
    return {
      icon: CircleSlash,
      row: 'border-rose-500/25 border-l-rose-500 bg-rose-500/5',
      badge: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      iconBox: 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-300',
    };
  }
  return {
    icon: Clock,
    row: 'border-amber-500/25 border-l-amber-500 bg-amber-500/5',
    badge:
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    iconBox:
      'bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-300',
  };
};

const loanStatusFilters: Array<{ value: LoanStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'PAID_OFF', label: 'Pagados' },
  { value: 'PAUSED', label: 'Pausados' },
  { value: 'CANCELLED', label: 'Cancelados' },
];

export default function LoansPage() {
  const { context } = useFinanceContext();
  const todayYmd = useHydrationSafeTodayYmd();
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [wallets, setWallets] = useState<PaymentMethodOption[]>([]);
  const [incomeTemplates, setIncomeTemplates] = useState<IncomeTemplateListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter>('ALL');
  const [paymentActionDraft, setPaymentActionDraft] =
    useState<PaymentActionDraft | null>(null);
  const [paymentActionSubmitting, setPaymentActionSubmitting] = useState(false);
  const [paymentActionErrors, setPaymentActionErrors] =
    useState<PaymentActionErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<LoanFormState>(() => defaultForm());

  const fundingWallets = useMemo(
    () =>
      wallets.filter((wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD'),
    [wallets],
  );

  const loadData = useCallback(async () => {
    if (context.type === 'user' && context.id === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
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
      const message =
        error instanceof Error ? error.message : 'No se pudieron cargar préstamos';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedLoanId === null) return;
    if (!loans.some((loan) => loan.id === selectedLoanId)) {
      setSelectedLoanId(null);
      setPaymentActionDraft(null);
      setPaymentActionErrors({});
    }
  }, [loans, selectedLoanId]);

  const activeLoans = loans.filter((loan) => loan.status === 'ACTIVE');
  const totalDebt = loans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const nextPaymentsTotal = activeLoans.reduce(
    (sum, loan) => sum + (loan.nextPayment?.amount ?? 0),
    0,
  );
  const visibleLoans =
    statusFilter === 'ALL'
      ? loans
      : loans.filter((loan) => loan.status === statusFilter);
  const selectedLoan = useMemo(
    () =>
      selectedLoanId === null
        ? null
        : loans.find((loan) => loan.id === selectedLoanId) ?? null,
    [loans, selectedLoanId],
  );
  const selectedLoanPayments = useMemo(
    () =>
      selectedLoan
        ? [...(selectedLoan.payments ?? [])].sort(
            (a, b) => a.sequence - b.sequence,
          )
        : [],
    [selectedLoan],
  );
  const selectedScheduleCounts = useMemo(
    () =>
      selectedLoanPayments.reduce(
        (counts, payment) => {
          const visualStatus = getPaymentVisualStatus(payment, todayYmd);
          counts[visualStatus] += 1;
          return counts;
        },
        {
          scheduled: 0,
          paid: 0,
          skipped: 0,
          cancelled: 0,
          overdue: 0,
        } satisfies Record<LoanPaymentVisualStatus, number>,
      ),
    [selectedLoanPayments, todayYmd],
  );

  useEffect(() => {
    if (!paymentActionDraft) return;
    if (!selectedLoanPayments.some((payment) => payment.id === paymentActionDraft.paymentId)) {
      setPaymentActionDraft(null);
      setPaymentActionErrors({});
    }
  }, [paymentActionDraft, selectedLoanPayments]);

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
      toast.success('Préstamo creado');
      setDialogOpen(false);
      setForm(defaultForm());
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo crear el préstamo',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setPaymentActionField = <K extends keyof PaymentActionDraft>(
    key: K,
    value: PaymentActionDraft[K],
  ) => {
    setPaymentActionDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
    setPaymentActionErrors((current) => ({
      ...current,
      [key]: undefined,
      general: undefined,
    }));
  };

  const startPaymentAction = (
    payment: LoanPaymentListItem,
    action: LoanPaymentActionValue,
  ) => {
    const defaultWalletId =
      payment.sourceWalletId ?? selectedLoan?.sourceWalletId ?? null;
    setPaymentActionDraft({
      paymentId: payment.id,
      action,
      paidAt: payment.paidAt ?? payment.dueDate,
      sourceWalletId: defaultWalletId ? String(defaultWalletId) : '',
      note: payment.note ?? '',
    });
    setPaymentActionErrors({});
  };

  const validatePaymentAction = () => {
    if (!paymentActionDraft || !selectedLoan) {
      return { general: 'Selecciona una acción para continuar.' };
    }

    const errors: PaymentActionErrors = {};
    if (paymentActionDraft.action === 'MARK_PAID') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentActionDraft.paidAt)) {
        errors.paidAt = 'Selecciona una fecha de pago válida.';
      }
      if (
        selectedLoan.paymentSource === 'WALLET' &&
        !paymentActionDraft.sourceWalletId
      ) {
        errors.sourceWalletId =
          'Selecciona la billetera que pagará este préstamo.';
      }
    }

    return errors;
  };

  const handlePaymentActionSubmit = async () => {
    if (!paymentActionDraft || !selectedLoan) return;
    const errors = validatePaymentAction();
    if (Object.keys(errors).length > 0) {
      setPaymentActionErrors(errors);
      return;
    }

    setPaymentActionSubmitting(true);
    setPaymentActionErrors({});
    try {
      const payload: Parameters<typeof applyLoanPaymentAction>[1] = {
        action: paymentActionDraft.action,
        note: paymentActionDraft.note.trim() || null,
      };

      if (paymentActionDraft.action === 'MARK_PAID') {
        payload.paidAt = paymentActionDraft.paidAt;
        if (selectedLoan.paymentSource === 'WALLET') {
          payload.sourceWalletId = Number(paymentActionDraft.sourceWalletId);
        }
      }

      await applyLoanPaymentAction(paymentActionDraft.paymentId, payload, context);
      toast.success(`${paymentActionLabel(paymentActionDraft.action)} aplicado`);
      setPaymentActionDraft(null);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el pago del préstamo';
      setPaymentActionErrors(mapPaymentActionError(message));
      toast.error(message);
    } finally {
      setPaymentActionSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
        <div>
          <h2 className="text-lg font-semibold leading-tight">Préstamos</h2>
          <p className="text-xs text-muted-foreground">
            Préstamos personales y de nómina con calendario de pagos.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo préstamo
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
          title="Próximos pagos"
          amount={nextPaymentsTotal}
          iconKey="trending-down"
          iconGradient="linear-gradient(135deg, #f97316 0%, #fb923c 100%)"
          subtitle="Siguiente pago por préstamo activo"
        />
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Préstamos activos
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {activeLoans.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">En seguimiento</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nómina
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {loans.filter((loan) => loan.type === 'PAYROLL').length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Con deducción o seguimiento
          </p>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar préstamos por estado"
      >
        {loanStatusFilters.map((filter) => {
          const count =
            filter.value === 'ALL'
              ? loans.length
              : loans.filter((loan) => loan.status === filter.value).length;
          const isSelected = statusFilter === filter.value;
          return (
            <Button
              key={filter.value}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => setStatusFilter(filter.value)}
              aria-pressed={isSelected}
            >
              {filter.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  isSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cargando préstamos...
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                No se pudieron cargar los préstamos.
              </p>
              <p className="text-xs text-muted-foreground">{loadError}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
            >
              Reintentar
            </Button>
          </div>
        ) : loans.length === 0 ? (
          <EmptyState
            message="No tienes préstamos registrados."
            description="Crea un préstamo para ver sus pagos en el panel financiero."
            action={{
              label: 'Crear préstamo',
              onClick: () => setDialogOpen(true),
            }}
          />
        ) : visibleLoans.length === 0 ? (
          <EmptyState
            message="No hay préstamos en este filtro."
            description="Cambia el estado seleccionado para revisar el resto del historial."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {visibleLoans.map((loan) => {
              const Icon = loan.type === 'PAYROLL' ? Landmark : HandCoins;
              return (
                <li
                  key={loan.id}
                  className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
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
                            ? `Nómina${loan.incomeTemplateName ? `: ${loan.incomeTemplateName}` : ''}`
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
                        Próximo
                      </p>
                      <p className="inline-flex items-center justify-end gap-1 text-xs font-medium">
                        <CalendarDays className="h-3 w-3" aria-hidden />
                        {loan.nextPayment
                          ? formatDate(loan.nextPayment.dueDate)
                          : 'Sin pagos'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5 justify-self-start md:justify-self-end"
                    onClick={() => {
                      setPaymentActionDraft(null);
                      setPaymentActionErrors({});
                      setSelectedLoanId(loan.id);
                    }}
                    aria-label={`Ver detalle de ${loan.name}`}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    Detalle
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo préstamo</DialogTitle>
            <DialogDescription>
              Captura el total, frecuencia y origen de pago para generar el calendario.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="loan-name">Nombre</Label>
                <Input
                  id="loan-name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Préstamo DiDi"
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
                    <SelectItem value="PERSONAL">Préstamo personal</SelectItem>
                    <SelectItem value="PAYROLL">Préstamo de nómina</SelectItem>
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
                <Label htmlFor="loan-count">Número de pagos</Label>
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
                      Deducción de nómina
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
                Crear préstamo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedLoan !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLoanId(null);
            setPaymentActionDraft(null);
            setPaymentActionErrors({});
          }
        }}
      >
        {selectedLoan ? (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedLoan.name}</DialogTitle>
              <DialogDescription>
                Calendario completo, origen de pago y estado operativo del préstamo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total pagadero
                  </p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums">
                    {formatCurrency(selectedLoan.totalPayable)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pagado
                  </p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(selectedLoan.paidAmount)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pendiente
                  </p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-foreground">
                    {formatCurrency(selectedLoan.remainingAmount)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Próximo pago
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedLoan.nextPayment
                      ? formatDate(selectedLoan.nextPayment.dueDate)
                      : 'Sin pagos pendientes'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Entidad
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedLoan.lender}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {typeLabel(selectedLoan.type)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Estado
                  </p>
                  <Badge
                    variant={selectedLoan.status === 'ACTIVE' ? 'default' : 'secondary'}
                    className="mt-1"
                  >
                    {statusLabel(selectedLoan.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Frecuencia
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {frequencyLabel(selectedLoan.frequency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Origen de pago
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedLoan.paymentSource === 'PAYROLL_DEDUCTION'
                      ? `Deducción de nómina${
                          selectedLoan.incomeTemplateName
                            ? `: ${selectedLoan.incomeTemplateName}`
                            : ''
                        }`
                      : selectedLoan.sourceWalletName ?? 'Billetera'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cuenta relacionada
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedLoan.linkedWalletName ?? 'Sin cuenta vinculada'}
                  </p>
                </div>
                {selectedLoan.notes ? (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Notas
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {selectedLoan.notes}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['overdue', 'Vencidos'],
                    ['scheduled', 'Por pagar'],
                    ['paid', 'Pagados'],
                    ['skipped', 'Omitidos'],
                    ['cancelled', 'Cancelados'],
                  ] satisfies Array<[LoanPaymentVisualStatus, string]>
                ).map(([status, label]) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {label}
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {selectedScheduleCounts[status]}
                    </span>
                  </span>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Calendario de pagos
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedLoan.paidPayments}/{selectedLoan.paymentCount} pagos
                    cubiertos
                  </p>
                </div>

                {selectedLoanPayments.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                    Este préstamo todavía no tiene pagos programados.
                  </div>
                ) : (
                  <ul className="space-y-2" role="list">
                    {selectedLoanPayments.map((payment) => {
                      const visualStatus = getPaymentVisualStatus(payment, todayYmd);
                      const tone = paymentStatusTone(visualStatus);
                      const StatusIcon = tone.icon;
                      const isActionOpen =
                        paymentActionDraft?.paymentId === payment.id;
                      const paymentSource =
                        payment.sourceWalletName ??
                        selectedLoan.sourceWalletName ??
                        (selectedLoan.paymentSource === 'PAYROLL_DEDUCTION'
                          ? 'Deducción de nómina'
                          : 'Billetera');

                      return (
                        <li
                          key={payment.id}
                          className={cn(
                            'grid gap-3 rounded-xl border border-l-[3px] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center',
                            tone.row,
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-xl ring-1',
                              tone.iconBox,
                            )}
                          >
                            <StatusIcon className="h-4 w-4" aria-hidden />
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                Pago #{payment.sequence}
                              </p>
                              <span
                                className={cn(
                                  'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-wider',
                                  tone.badge,
                                )}
                              >
                                {paymentStatusLabel(visualStatus)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span>Vence {formatDate(payment.dueDate)}</span>
                              {payment.paidAt ? (
                                <span>Pagado {formatDate(payment.paidAt)}</span>
                              ) : null}
                              <span>{paymentSource}</span>
                              <span className="inline-flex items-center gap-1">
                                <ReceiptText className="h-3 w-3" aria-hidden />
                                {payment.linkedExpenseId
                                  ? `Gasto #${payment.linkedExpenseId}`
                                  : 'Sin gasto vinculado'}
                              </span>
                            </div>
                            {payment.note ? (
                              <p className="mt-1 text-xs text-foreground/80">
                                {payment.note}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <p className="font-mono text-sm font-bold tabular-nums text-foreground sm:text-right">
                              {formatCurrency(payment.amount)}
                            </p>
                            {payment.status === 'SCHEDULED' ? (
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-[10px]"
                                  onClick={() =>
                                    startPaymentAction(payment, 'MARK_PAID')
                                  }
                                  disabled={paymentActionSubmitting}
                                >
                                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                                  Pagar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
                                  onClick={() => startPaymentAction(payment, 'SKIP')}
                                  disabled={paymentActionSubmitting}
                                >
                                  <CircleSlash className="h-3 w-3" aria-hidden />
                                  Omitir
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-[10px] text-destructive hover:text-destructive"
                                  onClick={() =>
                                    startPaymentAction(payment, 'CANCEL')
                                  }
                                  disabled={paymentActionSubmitting}
                                >
                                  <CircleSlash className="h-3 w-3" aria-hidden />
                                  Cancelar
                                </Button>
                              </div>
                            ) : null}
                            {payment.status === 'PAID' ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[10px]"
                                onClick={() =>
                                  startPaymentAction(payment, 'MARK_SCHEDULED')
                                }
                                disabled={paymentActionSubmitting}
                              >
                                <Undo2 className="h-3 w-3" aria-hidden />
                                Deshacer
                              </Button>
                            ) : null}
                          </div>

                          {isActionOpen && paymentActionDraft ? (
                            <div className="rounded-xl border border-border/60 bg-background p-3 shadow-sm sm:col-span-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {paymentActionLabel(paymentActionDraft.action)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {paymentActionDescription(
                                    paymentActionDraft.action,
                                    selectedLoan.paymentSource,
                                  )}
                                </p>
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {paymentActionDraft.action === 'MARK_PAID' ? (
                                  <>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`loan-payment-${payment.id}-paid-at`}>
                                        Fecha de pago
                                      </Label>
                                      <Input
                                        id={`loan-payment-${payment.id}-paid-at`}
                                        type="date"
                                        value={paymentActionDraft.paidAt}
                                        onChange={(event) =>
                                          setPaymentActionField(
                                            'paidAt',
                                            event.target.value,
                                          )
                                        }
                                        aria-invalid={Boolean(paymentActionErrors.paidAt)}
                                        className={cn(
                                          paymentActionErrors.paidAt &&
                                            'border-destructive focus-visible:ring-destructive/30',
                                        )}
                                      />
                                      {paymentActionErrors.paidAt ? (
                                        <p className="text-xs text-destructive">
                                          {paymentActionErrors.paidAt}
                                        </p>
                                      ) : null}
                                    </div>

                                    {selectedLoan.paymentSource === 'WALLET' ? (
                                      <div className="space-y-1.5">
                                        <Label>Billetera de pago</Label>
                                        <Select
                                          value={paymentActionDraft.sourceWalletId}
                                          onValueChange={(value) =>
                                            setPaymentActionField(
                                              'sourceWalletId',
                                              value,
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            className={cn(
                                              paymentActionErrors.sourceWalletId &&
                                                'border-destructive focus:ring-destructive/30',
                                            )}
                                            aria-invalid={Boolean(
                                              paymentActionErrors.sourceWalletId,
                                            )}
                                          >
                                            <SelectValue placeholder="Selecciona billetera" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {fundingWallets.map((wallet) => (
                                              <SelectItem
                                                key={wallet.id}
                                                value={String(wallet.id)}
                                              >
                                                {wallet.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {paymentActionErrors.sourceWalletId ? (
                                          <p className="text-xs text-destructive">
                                            {paymentActionErrors.sourceWalletId}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}

                                <div className="space-y-1.5 sm:col-span-2">
                                  <Label htmlFor={`loan-payment-${payment.id}-note`}>
                                    Nota opcional
                                  </Label>
                                  <Textarea
                                    id={`loan-payment-${payment.id}-note`}
                                    value={paymentActionDraft.note}
                                    onChange={(event) =>
                                      setPaymentActionField(
                                        'note',
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Motivo o referencia del cambio"
                                    className="min-h-20"
                                  />
                                  {paymentActionErrors.note ? (
                                    <p className="text-xs text-destructive">
                                      {paymentActionErrors.note}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              {paymentActionErrors.general ? (
                                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                  {paymentActionErrors.general}
                                </div>
                              ) : null}

                              <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPaymentActionDraft(null);
                                    setPaymentActionErrors({});
                                  }}
                                  disabled={paymentActionSubmitting}
                                >
                                  Cerrar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className={cn(
                                    'gap-2',
                                    paymentActionSubmitting && 'opacity-80',
                                  )}
                                  onClick={() => void handlePaymentActionSubmit()}
                                  disabled={paymentActionSubmitting}
                                >
                                  {paymentActionSubmitting ? (
                                    <Loader2
                                      className="h-4 w-4 animate-spin"
                                      aria-hidden
                                    />
                                  ) : null}
                                  {paymentActionLabel(paymentActionDraft.action)}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
