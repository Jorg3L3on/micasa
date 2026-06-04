'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  Pause,
  Pencil,
  Play,
  Plus,
  ReceiptText,
  Save,
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
import {
  applyLoanPaymentAction,
  createLoan,
  listLoans,
  updateLoan,
} from '@/lib/api/loans';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import type { PaymentMethodOption, IncomeTemplateListItem } from '@/types/catalog';
import {
  createLoanSchema,
  type CreateLoanInput,
  type UpdateLoanInput,
} from '@/schemas/loan.schema';
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
type LoanEditFormState = {
  name: string;
  lender: string;
  linkedWalletId: string;
  incomeTemplateId: string;
  notes: string;
};

type LoanStatusFilter = LoanListItem['status'] | 'ALL';
type LoanLifecycleTarget = Extract<
  LoanListItem['status'],
  'ACTIVE' | 'PAUSED' | 'CANCELLED'
>;
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
type LoanFormErrors = Partial<Record<keyof LoanFormState | 'general', string>>;
type LoanEditErrors = Partial<
  Record<
    'name' | 'lender' | 'linkedWalletId' | 'incomeTemplateId' | 'notes' | 'general',
    string
  >
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

const loanFormErrorFields = new Set<keyof LoanFormState>([
  'name',
  'lender',
  'type',
  'principalAmount',
  'paymentAmount',
  'paymentCount',
  'frequency',
  'startDate',
  'paymentSource',
  'sourceWalletId',
  'linkedWalletId',
  'incomeTemplateId',
  'notes',
]);

const editFormFromLoan = (loan: LoanListItem): LoanEditFormState => ({
  name: loan.name,
  lender: loan.lender,
  linkedWalletId: loan.linkedWalletId ? String(loan.linkedWalletId) : 'none',
  incomeTemplateId: loan.incomeTemplateId ? String(loan.incomeTemplateId) : 'none',
  notes: loan.notes ?? '',
});

const loanPaymentSourceLabel = (
  loan: Pick<
    LoanListItem,
    'paymentSource' | 'incomeTemplateName' | 'sourceWalletName'
  >,
) => {
  if (loan.paymentSource === 'PAYROLL_DEDUCTION') {
    return loan.incomeTemplateName
      ? `Deducción de nómina: ${loan.incomeTemplateName}`
      : 'Deducción de nómina';
  }

  return loan.sourceWalletName ?? 'Billetera';
};

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

const lifecycleLabel = (status: LoanLifecycleTarget) => {
  if (status === 'PAUSED') return 'Pausar préstamo';
  if (status === 'CANCELLED') return 'Cancelar préstamo';
  return 'Reanudar préstamo';
};

const lifecycleDescription = (status: LoanLifecycleTarget) => {
  if (status === 'PAUSED') {
    return 'El préstamo saldrá de las obligaciones activas mientras esté pausado, sin borrar su historial.';
  }
  if (status === 'CANCELLED') {
    return 'El préstamo se cancelará sin eliminar pagos históricos ni gastos generados. Sus pagos pendientes dejarán de planificarse como activos.';
  }
  return 'El préstamo volverá al seguimiento activo y sus pagos pendientes aparecerán de nuevo en la planeación.';
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

const mapLoanFormIssues = (
  issues: Array<{ path: PropertyKey[]; message: string }>,
): LoanFormErrors => {
  const errors: LoanFormErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && loanFormErrorFields.has(key as keyof LoanFormState)) {
      errors[key as keyof LoanFormState] = issue.message;
      continue;
    }
    errors.general = issue.message;
  }
  return errors;
};

const mapLoanEditError = (message: string): LoanEditErrors => {
  const normalized = message.toLowerCase();
  if (normalized.includes('billetera') || normalized.includes('cuenta')) {
    return { linkedWalletId: message };
  }
  if (normalized.includes('plantilla') || normalized.includes('nómina')) {
    return { incomeTemplateId: message };
  }
  if (normalized.includes('nombre')) return { name: message };
  if (normalized.includes('entidad')) return { lender: message };
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [loanEditOpen, setLoanEditOpen] = useState(false);
  const [loanEditForm, setLoanEditForm] = useState<LoanEditFormState | null>(
    null,
  );
  const [loanEditErrors, setLoanEditErrors] = useState<LoanEditErrors>({});
  const [loanEditSubmitting, setLoanEditSubmitting] = useState(false);
  const [lifecycleDraft, setLifecycleDraft] =
    useState<LoanLifecycleTarget | null>(null);
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<LoanFormState>(() => defaultForm());
  const [formErrors, setFormErrors] = useState<LoanFormErrors>({});

  const resetLoanDetailDrafts = useCallback(() => {
    setPaymentActionDraft(null);
    setPaymentActionErrors({});
    setLoanEditOpen(false);
    setLoanEditForm(null);
    setLoanEditErrors({});
    setLifecycleDraft(null);
  }, []);

  const clearLoanIdQueryParam = useCallback(() => {
    if (!searchParams.has('loanId')) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('loanId');
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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
      resetLoanDetailDrafts();
    }
  }, [loans, resetLoanDetailDrafts, selectedLoanId]);

  useEffect(() => {
    const loanIdParam = searchParams.get('loanId');
    if (!loanIdParam) return;

    const loanId = Number(loanIdParam);
    if (!Number.isInteger(loanId) || loanId <= 0) return;
    if (selectedLoanId === loanId) return;
    if (!loans.some((loan) => loan.id === loanId)) return;

    resetLoanDetailDrafts();
    setSelectedLoanId(loanId);
  }, [loans, resetLoanDetailDrafts, searchParams, selectedLoanId]);

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
    setFormErrors((current) => ({
      ...current,
      [key]: undefined,
      general: undefined,
    }));
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
    const parsed = createLoanSchema.safeParse({
      name: form.name,
      lender: form.lender,
      type: form.type,
      principalAmount: form.principalAmount,
      paymentAmount: form.paymentAmount,
      paymentCount: form.paymentCount,
      frequency: form.frequency,
      startDate: form.startDate,
      paymentSource: form.paymentSource,
      sourceWalletId: form.sourceWalletId,
      linkedWalletId: form.linkedWalletId,
      incomeTemplateId: form.incomeTemplateId,
      notes: form.notes || null,
    });

    if (!parsed.success) {
      setFormErrors(mapLoanFormIssues(parsed.error.issues));
      return;
    }

    setSubmitting(true);
    setFormErrors({});
    try {
      const payload: CreateLoanInput = parsed.data;
      await createLoan(payload, context);
      toast.success('Préstamo creado');
      setDialogOpen(false);
      setForm(defaultForm());
      setFormErrors({});
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo crear el préstamo';
      setFormErrors({ general: message });
      toast.error(message);
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

  const setLoanEditField = <K extends keyof LoanEditFormState>(
    key: K,
    value: LoanEditFormState[K],
  ) => {
    setLoanEditForm((current) =>
      current ? { ...current, [key]: value } : current,
    );
    setLoanEditErrors((current) => ({
      ...current,
      [key]: undefined,
      general: undefined,
    }));
  };

  const startLoanEdit = (loan: LoanListItem) => {
    setLoanEditForm(editFormFromLoan(loan));
    setLoanEditErrors({});
    setLifecycleDraft(null);
    setLoanEditOpen(true);
  };

  const validateLoanEdit = () => {
    if (!loanEditForm) return { general: 'Selecciona un préstamo para editar.' };

    const errors: LoanEditErrors = {};
    if (!loanEditForm.name.trim()) {
      errors.name = 'El nombre es obligatorio.';
    }
    if (!loanEditForm.lender.trim()) {
      errors.lender = 'La entidad es obligatoria.';
    }

    return errors;
  };

  const handleLoanEditSubmit = async () => {
    if (!selectedLoan || !loanEditForm) return;
    const errors = validateLoanEdit();
    if (Object.keys(errors).length > 0) {
      setLoanEditErrors(errors);
      return;
    }

    setLoanEditSubmitting(true);
    setLoanEditErrors({});
    try {
      const payload: UpdateLoanInput = {
        name: loanEditForm.name,
        lender: loanEditForm.lender,
        linkedWalletId:
          loanEditForm.linkedWalletId === 'none'
            ? null
            : Number(loanEditForm.linkedWalletId),
        incomeTemplateId:
          selectedLoan.paymentSource === 'PAYROLL_DEDUCTION' &&
          loanEditForm.incomeTemplateId !== 'none'
            ? Number(loanEditForm.incomeTemplateId)
            : null,
        notes: loanEditForm.notes.trim() || null,
      };

      await updateLoan(selectedLoan.id, payload, context);
      toast.success('Préstamo actualizado');
      setLoanEditOpen(false);
      setLoanEditForm(null);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el préstamo';
      setLoanEditErrors(mapLoanEditError(message));
      toast.error(message);
    } finally {
      setLoanEditSubmitting(false);
    }
  };

  const handleLifecycleSubmit = async () => {
    if (!selectedLoan || !lifecycleDraft) return;

    setLifecycleSubmitting(true);
    setLoanEditErrors({});
    try {
      await updateLoan(selectedLoan.id, { status: lifecycleDraft }, context);
      toast.success(lifecycleLabel(lifecycleDraft));
      setLifecycleDraft(null);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el estado del préstamo';
      setLoanEditErrors({ general: message });
      toast.error(message);
    } finally {
      setLifecycleSubmitting(false);
    }
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

  const selectedLoanProgress = selectedLoan?.totalPayable
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round((selectedLoan.paidAmount / selectedLoan.totalPayable) * 100),
        ),
      )
    : 0;
  const selectedLoanPaymentSource = selectedLoan
    ? loanPaymentSourceLabel(selectedLoan)
    : '';

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
                  className={cn(
                    'grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center',
                    loan.status === 'PAUSED' && 'bg-amber-500/5',
                    loan.status === 'CANCELLED' && 'bg-muted/40 opacity-80',
                  )}
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
                      resetLoanDetailDrafts();
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormErrors({});
        }}
      >
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
                  aria-invalid={Boolean(formErrors.name)}
                  className={cn(
                    formErrors.name &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  required
                />
                {formErrors.name ? (
                  <p className="text-xs text-destructive">{formErrors.name}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-lender">Entidad</Label>
                <Input
                  id="loan-lender"
                  value={form.lender}
                  onChange={(e) => setField('lender', e.target.value)}
                  placeholder="DiDi, banco, empresa"
                  aria-invalid={Boolean(formErrors.lender)}
                  className={cn(
                    formErrors.lender &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  required
                />
                {formErrors.lender ? (
                  <p className="text-xs text-destructive">{formErrors.lender}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setField('type', value as LoanFormState['type'])
                  }
                >
                  <SelectTrigger
                    aria-label="Tipo de préstamo"
                    aria-invalid={Boolean(formErrors.type)}
                    className={cn(
                      formErrors.type &&
                        'border-destructive focus:ring-destructive/30',
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSONAL">Préstamo personal</SelectItem>
                    <SelectItem value="PAYROLL">Préstamo de nómina</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.type ? (
                  <p className="text-xs text-destructive">{formErrors.type}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Periodicidad</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(value) =>
                    setField('frequency', value as LoanFormState['frequency'])
                  }
                >
                  <SelectTrigger
                    aria-label="Periodicidad del préstamo"
                    aria-invalid={Boolean(formErrors.frequency)}
                    className={cn(
                      formErrors.frequency &&
                        'border-destructive focus:ring-destructive/30',
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Quincenal</SelectItem>
                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.frequency ? (
                  <p className="text-xs text-destructive">
                    {formErrors.frequency}
                  </p>
                ) : null}
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
                  aria-invalid={Boolean(formErrors.principalAmount)}
                  className={cn(
                    formErrors.principalAmount &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  required
                />
                {formErrors.principalAmount ? (
                  <p className="text-xs text-destructive">
                    {formErrors.principalAmount}
                  </p>
                ) : null}
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
                  aria-invalid={Boolean(formErrors.paymentAmount)}
                  className={cn(
                    formErrors.paymentAmount &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  required
                />
                {formErrors.paymentAmount ? (
                  <p className="text-xs text-destructive">
                    {formErrors.paymentAmount}
                  </p>
                ) : null}
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
                  aria-invalid={Boolean(formErrors.paymentCount)}
                  className={cn(
                    formErrors.paymentCount &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  required
                />
                {formErrors.paymentCount ? (
                  <p className="text-xs text-destructive">
                    {formErrors.paymentCount}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-start">Primer pago</Label>
                <Input
                  id="loan-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField('startDate', e.target.value)}
                  aria-invalid={Boolean(formErrors.startDate)}
                  className={cn(
                    formErrors.startDate &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  required
                />
                {formErrors.startDate ? (
                  <p className="text-xs text-destructive">
                    {formErrors.startDate}
                  </p>
                ) : null}
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
                  <SelectTrigger
                    aria-label="Forma de pago del préstamo"
                    aria-invalid={Boolean(formErrors.paymentSource)}
                    className={cn(
                      formErrors.paymentSource &&
                        'border-destructive focus:ring-destructive/30',
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALLET">Desde billetera</SelectItem>
                    <SelectItem value="PAYROLL_DEDUCTION">
                      Deducción de nómina
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Billetera proyecta salidas futuras; nómina descuenta el
                  ingreso esperado.
                </p>
                {formErrors.paymentSource ? (
                  <p className="text-xs text-destructive">
                    {formErrors.paymentSource}
                  </p>
                ) : null}
              </div>
              {form.paymentSource === 'WALLET' ? (
                <div className="space-y-1.5">
                  <Label>Billetera de pago</Label>
                  <Select
                    value={form.sourceWalletId}
                    onValueChange={(value) => setField('sourceWalletId', value)}
                  >
                    <SelectTrigger
                      aria-label="Billetera que pagará el préstamo"
                      aria-invalid={Boolean(formErrors.sourceWalletId)}
                      className={cn(
                        formErrors.sourceWalletId &&
                          'border-destructive focus:ring-destructive/30',
                      )}
                    >
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
                  {formErrors.sourceWalletId ? (
                    <p className="text-xs text-destructive">
                      {formErrors.sourceWalletId}
                    </p>
                  ) : null}
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
                    <SelectTrigger
                      aria-label="Ingreso relacionado con la deducción"
                      aria-invalid={Boolean(formErrors.incomeTemplateId)}
                      className={cn(
                        formErrors.incomeTemplateId &&
                          'border-destructive focus:ring-destructive/30',
                      )}
                    >
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
                  {formErrors.incomeTemplateId ? (
                    <p className="text-xs text-destructive">
                      {formErrors.incomeTemplateId}
                    </p>
                  ) : null}
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
                  <SelectTrigger
                    aria-label="Cuenta relacionada para seguimiento"
                    aria-invalid={Boolean(formErrors.linkedWalletId)}
                    className={cn(
                      formErrors.linkedWalletId &&
                        'border-destructive focus:ring-destructive/30',
                    )}
                  >
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
                <p className="text-[11px] text-muted-foreground">
                  Solo relaciona el préstamo con una cuenta para consulta; no
                  mueve saldo ni paga el préstamo.
                </p>
                {formErrors.linkedWalletId ? (
                  <p className="text-xs text-destructive">
                    {formErrors.linkedWalletId}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="loan-notes">Notas</Label>
                <Textarea
                  id="loan-notes"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Condiciones, referencia, comentarios"
                  aria-invalid={Boolean(formErrors.notes)}
                  className={cn(
                    formErrors.notes &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                />
                {formErrors.notes ? (
                  <p className="text-xs text-destructive">{formErrors.notes}</p>
                ) : null}
              </div>
            </div>
            {formErrors.general ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formErrors.general}
              </div>
            ) : null}
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
            resetLoanDetailDrafts();
            clearLoanIdQueryParam();
          }
        }}
      >
        {selectedLoan ? (
          <DialogContent className="flex max-h-[92dvh] max-w-[calc(100%-0.75rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(92dvh,44rem)] sm:max-w-3xl lg:max-w-[52rem]">
            <DialogHeader className="border-b border-border/60 px-4 py-3 pr-12 text-left sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <HandCoins className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="truncate text-base font-semibold sm:text-lg">
                      {selectedLoan.name}
                    </DialogTitle>
                    <Badge
                      variant={
                        selectedLoan.status === 'CANCELLED'
                          ? 'destructive'
                          : selectedLoan.status === 'ACTIVE'
                            ? 'default'
                            : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {statusLabel(selectedLoan.status)}
                    </Badge>
                  </div>
                  <DialogDescription className="mt-1 text-xs">
                    {selectedLoan.lender} · {typeLabel(selectedLoan.type)} ·{' '}
                    {frequencyLabel(selectedLoan.frequency)}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <aside className="order-2 space-y-3 lg:sticky lg:top-0 lg:order-1 lg:self-start">
                  <section className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Saldo pendiente
                        </p>
                        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">
                          {formatCurrency(selectedLoan.remainingAmount)}
                        </p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                        <Landmark className="h-4 w-4" aria-hidden />
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Progreso</span>
                        <span className="font-mono font-semibold tabular-nums text-foreground">
                          {selectedLoanProgress}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${selectedLoanProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedLoan.paidPayments}/{selectedLoan.paymentCount} pagos
                        cubiertos
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/35 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pagado
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(selectedLoan.paidAmount)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/35 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Total
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatCurrency(selectedLoan.totalPayable)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/35 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pago
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatCurrency(selectedLoan.paymentAmount)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/35 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Inicio
                        </p>
                        <p className="mt-1 text-xs font-semibold text-foreground">
                          {formatDate(selectedLoan.startDate)}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 space-y-3 border-t border-border/60 pt-3 text-xs">
                      <div>
                        <dt className="font-semibold uppercase tracking-wider text-muted-foreground">
                          Origen de pago
                        </dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {selectedLoanPaymentSource}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wider text-muted-foreground">
                          Cuenta relacionada
                        </dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {selectedLoan.linkedWalletName ?? 'Sin cuenta vinculada'}
                        </dd>
                      </div>
                      {selectedLoan.notes ? (
                        <div>
                          <dt className="font-semibold uppercase tracking-wider text-muted-foreground">
                            Notas
                          </dt>
                          <dd className="mt-1 text-foreground/85">
                            {selectedLoan.notes}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  <section className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Acciones
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-center gap-1.5"
                        onClick={() => startLoanEdit(selectedLoan)}
                        disabled={loanEditSubmitting || lifecycleSubmitting}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Editar
                      </Button>
                      {selectedLoan.status === 'ACTIVE' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-center gap-1.5"
                          onClick={() => {
                            setLoanEditOpen(false);
                            setLifecycleDraft('PAUSED');
                            setLoanEditErrors({});
                          }}
                          disabled={loanEditSubmitting || lifecycleSubmitting}
                        >
                          <Pause className="h-3.5 w-3.5" aria-hidden />
                          Pausar
                        </Button>
                      ) : null}
                      {selectedLoan.status === 'PAUSED' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-center gap-1.5"
                          onClick={() => {
                            setLoanEditOpen(false);
                            setLifecycleDraft('ACTIVE');
                            setLoanEditErrors({});
                          }}
                          disabled={loanEditSubmitting || lifecycleSubmitting}
                        >
                          <Play className="h-3.5 w-3.5" aria-hidden />
                          Reanudar
                        </Button>
                      ) : null}
                      {selectedLoan.status === 'ACTIVE' ||
                      selectedLoan.status === 'PAUSED' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="col-span-2 justify-center gap-1.5 text-destructive hover:text-destructive lg:col-span-1"
                          onClick={() => {
                            setLoanEditOpen(false);
                            setLifecycleDraft('CANCELLED');
                            setLoanEditErrors({});
                          }}
                          disabled={loanEditSubmitting || lifecycleSubmitting}
                        >
                          <CircleSlash className="h-3.5 w-3.5" aria-hidden />
                          Cancelar préstamo
                        </Button>
                      ) : null}
                    </div>
                  </section>

                  {lifecycleDraft ? (
                    <section className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                      <div className="flex gap-3">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
                            lifecycleDraft === 'CANCELLED'
                              ? 'bg-destructive/10 text-destructive ring-destructive/30'
                              : 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300',
                          )}
                        >
                          {lifecycleDraft === 'ACTIVE' ? (
                            <Play className="h-4 w-4" aria-hidden />
                          ) : lifecycleDraft === 'PAUSED' ? (
                            <Pause className="h-4 w-4" aria-hidden />
                          ) : (
                            <CircleSlash className="h-4 w-4" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {lifecycleLabel(lifecycleDraft)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lifecycleDescription(lifecycleDraft)}
                          </p>
                        </div>
                      </div>
                      {loanEditErrors.general ? (
                        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {loanEditErrors.general}
                        </div>
                      ) : null}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLifecycleDraft(null);
                            setLoanEditErrors({});
                          }}
                          disabled={lifecycleSubmitting}
                        >
                          Cerrar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            lifecycleDraft === 'CANCELLED'
                              ? 'destructive'
                              : 'default'
                          }
                          className={cn('gap-2', lifecycleSubmitting && 'opacity-80')}
                          onClick={() => void handleLifecycleSubmit()}
                          disabled={lifecycleSubmitting}
                        >
                          {lifecycleSubmitting ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden
                            />
                          ) : null}
                          Aplicar
                        </Button>
                      </div>
                    </section>
                  ) : null}
                </aside>

                <section className="order-1 min-w-0 space-y-4 lg:order-2">
                  {loanEditOpen && loanEditForm ? (
                    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            Editar datos seguros
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Estos campos no recalculan el calendario ni alteran pagos
                            ya generados.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Calendario bloqueado
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`loan-${selectedLoan.id}-edit-name`}>
                            Nombre
                          </Label>
                          <Input
                            id={`loan-${selectedLoan.id}-edit-name`}
                            value={loanEditForm.name}
                            onChange={(event) =>
                              setLoanEditField('name', event.target.value)
                            }
                            aria-invalid={Boolean(loanEditErrors.name)}
                            className={cn(
                              loanEditErrors.name &&
                                'border-destructive focus-visible:ring-destructive/30',
                            )}
                          />
                          {loanEditErrors.name ? (
                            <p className="text-xs text-destructive">
                              {loanEditErrors.name}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`loan-${selectedLoan.id}-edit-lender`}>
                            Entidad
                          </Label>
                          <Input
                            id={`loan-${selectedLoan.id}-edit-lender`}
                            value={loanEditForm.lender}
                            onChange={(event) =>
                              setLoanEditField('lender', event.target.value)
                            }
                            aria-invalid={Boolean(loanEditErrors.lender)}
                            className={cn(
                              loanEditErrors.lender &&
                                'border-destructive focus-visible:ring-destructive/30',
                            )}
                          />
                          {loanEditErrors.lender ? (
                            <p className="text-xs text-destructive">
                              {loanEditErrors.lender}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cuenta relacionada</Label>
                          <Select
                            value={loanEditForm.linkedWalletId}
                            onValueChange={(value) =>
                              setLoanEditField('linkedWalletId', value)
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                loanEditErrors.linkedWalletId &&
                                  'border-destructive focus:ring-destructive/30',
                              )}
                              aria-invalid={Boolean(loanEditErrors.linkedWalletId)}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                Sin cuenta vinculada
                              </SelectItem>
                              {wallets.map((wallet) => (
                                <SelectItem
                                  key={wallet.id}
                                  value={String(wallet.id)}
                                >
                                  {wallet.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Relaciona el préstamo para consulta; no mueve dinero.
                          </p>
                          {loanEditErrors.linkedWalletId ? (
                            <p className="text-xs text-destructive">
                              {loanEditErrors.linkedWalletId}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Ingreso relacionado</Label>
                          {selectedLoan.paymentSource === 'PAYROLL_DEDUCTION' ? (
                            <Select
                              value={loanEditForm.incomeTemplateId}
                              onValueChange={(value) =>
                                setLoanEditField('incomeTemplateId', value)
                              }
                            >
                              <SelectTrigger
                                className={cn(
                                  loanEditErrors.incomeTemplateId &&
                                    'border-destructive focus:ring-destructive/30',
                                )}
                                aria-invalid={Boolean(
                                  loanEditErrors.incomeTemplateId,
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  Sin ingreso vinculado
                                </SelectItem>
                                {incomeTemplates.map((template) => (
                                  <SelectItem
                                    key={template.id}
                                    value={String(template.id)}
                                  >
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                              Solo aplica a préstamos con deducción de nómina.
                            </div>
                          )}
                          {loanEditErrors.incomeTemplateId ? (
                            <p className="text-xs text-destructive">
                              {loanEditErrors.incomeTemplateId}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`loan-${selectedLoan.id}-edit-notes`}>
                            Notas
                          </Label>
                          <Textarea
                            id={`loan-${selectedLoan.id}-edit-notes`}
                            value={loanEditForm.notes}
                            onChange={(event) =>
                              setLoanEditField('notes', event.target.value)
                            }
                            placeholder="Condiciones, referencia, comentarios"
                            className="min-h-20"
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                        <span>Total: {formatCurrency(selectedLoan.totalPayable)}</span>
                        <span>Pago: {formatCurrency(selectedLoan.paymentAmount)}</span>
                        <span>Pagos: {selectedLoan.paymentCount}</span>
                        <span>Frecuencia: {frequencyLabel(selectedLoan.frequency)}</span>
                        <span>Primer pago: {formatDate(selectedLoan.startDate)}</span>
                        <span>{typeLabel(selectedLoan.type)}</span>
                      </div>

                      {loanEditErrors.general ? (
                        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {loanEditErrors.general}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLoanEditOpen(false);
                            setLoanEditForm(null);
                            setLoanEditErrors({});
                          }}
                          disabled={loanEditSubmitting}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className={cn('gap-2', loanEditSubmitting && 'opacity-80')}
                          onClick={() => void handleLoanEditSubmit()}
                          disabled={loanEditSubmitting}
                        >
                          {loanEditSubmitting ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Save className="h-4 w-4" aria-hidden />
                          )}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-border/60 bg-card shadow-sm">
                    <div className="border-b border-border/60 p-3 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Calendario de pagos
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Próximo:{' '}
                            {selectedLoan.nextPayment
                              ? formatDate(selectedLoan.nextPayment.dueDate)
                              : 'Sin pagos pendientes'}
                          </p>
                        </div>
                        <Badge variant="outline" className="w-fit text-[10px]">
                          {selectedLoan.paidPayments}/{selectedLoan.paymentCount}{' '}
                          cubiertos
                        </Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
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
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {label}
                            <span className="font-mono font-semibold tabular-nums text-foreground">
                              {selectedScheduleCounts[status]}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 sm:p-4">
                      {selectedLoanPayments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                          Este préstamo todavía no tiene pagos programados.
                        </div>
                      ) : (
                        <ul className="space-y-2" role="list">
                          {selectedLoanPayments.map((payment) => {
                            const visualStatus = getPaymentVisualStatus(
                              payment,
                              todayYmd,
                            );
                            const tone = paymentStatusTone(visualStatus);
                            const StatusIcon = tone.icon;
                            const isActionOpen =
                              paymentActionDraft?.paymentId === payment.id;
                            const paymentSource =
                              payment.sourceWalletName ??
                              selectedLoanPaymentSource;

                            return (
                              <li
                                key={payment.id}
                                className={cn(
                                  'grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-l-[3px] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start',
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
                                      <span>
                                        Pagado {formatDate(payment.paidAt)}
                                      </span>
                                    ) : null}
                                    <span>{paymentSource}</span>
                                    <span className="inline-flex items-center gap-1">
                                      <ReceiptText
                                        className="h-3 w-3"
                                        aria-hidden
                                      />
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

                                <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border/50 pt-2 sm:col-span-1 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                                  <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                                    {formatCurrency(payment.amount)}
                                  </p>
                                  {payment.status === 'SCHEDULED' ? (
                                    <div className="grid grid-cols-3 gap-1 sm:mt-2 sm:flex sm:justify-end sm:gap-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 min-w-0 justify-center gap-1 px-1.5 text-[10px]"
                                        onClick={() =>
                                          startPaymentAction(payment, 'MARK_PAID')
                                        }
                                        disabled={paymentActionSubmitting}
                                      >
                                        <CheckCircle2
                                          className="h-3 w-3"
                                          aria-hidden
                                        />
                                        Pagar
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 min-w-0 justify-center gap-1 px-1.5 text-[10px] text-muted-foreground"
                                        onClick={() =>
                                          startPaymentAction(payment, 'SKIP')
                                        }
                                        disabled={paymentActionSubmitting}
                                      >
                                        <CircleSlash
                                          className="h-3 w-3"
                                          aria-hidden
                                        />
                                        Omitir
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 min-w-0 justify-center gap-1 px-1.5 text-[10px] text-destructive hover:text-destructive"
                                        onClick={() =>
                                          startPaymentAction(payment, 'CANCEL')
                                        }
                                        disabled={paymentActionSubmitting}
                                      >
                                        <CircleSlash
                                          className="h-3 w-3"
                                          aria-hidden
                                        />
                                        Cancelar
                                      </Button>
                                    </div>
                                  ) : null}
                                  {payment.status === 'PAID' ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 px-2 text-[10px] sm:mt-2"
                                      onClick={() =>
                                        startPaymentAction(
                                          payment,
                                          'MARK_SCHEDULED',
                                        )
                                      }
                                      disabled={paymentActionSubmitting}
                                    >
                                      <Undo2 className="h-3 w-3" aria-hidden />
                                      Deshacer
                                    </Button>
                                  ) : null}
                                </div>

                                {isActionOpen && paymentActionDraft ? (
                                  <div className="col-span-2 rounded-xl border border-border/60 bg-background p-3 shadow-sm sm:col-span-3">
                                    <div className="flex items-start gap-3">
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                                        <CheckCircle2
                                          className="h-4 w-4"
                                          aria-hidden
                                        />
                                      </span>
                                      <div className="min-w-0 space-y-1">
                                        <p className="text-sm font-semibold text-foreground">
                                          {paymentActionLabel(
                                            paymentActionDraft.action,
                                          )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {paymentActionDescription(
                                            paymentActionDraft.action,
                                            selectedLoan.paymentSource,
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    <div
                                      className={cn(
                                        'mt-3 grid gap-3',
                                        paymentActionDraft.action === 'MARK_PAID' &&
                                          selectedLoan.paymentSource === 'WALLET'
                                          ? 'min-[380px]:grid-cols-[145px_minmax(0,1fr)]'
                                          : 'sm:grid-cols-2',
                                      )}
                                    >
                                      {paymentActionDraft.action === 'MARK_PAID' ? (
                                        <>
                                          <div className="space-y-1.5">
                                            <Label
                                              htmlFor={`loan-payment-${payment.id}-paid-at`}
                                            >
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
                                              aria-invalid={Boolean(
                                                paymentActionErrors.paidAt,
                                              )}
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
                                                value={
                                                  paymentActionDraft.sourceWalletId
                                                }
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
                                                  {
                                                    paymentActionErrors.sourceWalletId
                                                  }
                                                </p>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </>
                                      ) : null}

                                      <div
                                        className={cn(
                                          'space-y-1.5',
                                          paymentActionDraft.action === 'MARK_PAID' &&
                                            selectedLoan.paymentSource === 'WALLET'
                                            ? 'min-[380px]:col-span-2'
                                            : 'sm:col-span-2',
                                        )}
                                      >
                                        <Label
                                          htmlFor={`loan-payment-${payment.id}-note`}
                                        >
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
                                          className="min-h-16"
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

                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
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
                                        onClick={() =>
                                          void handlePaymentActionSubmit()
                                        }
                                        disabled={paymentActionSubmitting}
                                      >
                                        {paymentActionSubmitting ? (
                                          <Loader2
                                            className="h-4 w-4 animate-spin"
                                            aria-hidden
                                          />
                                        ) : null}
                                        {paymentActionLabel(
                                          paymentActionDraft.action,
                                        )}
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
                </section>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
