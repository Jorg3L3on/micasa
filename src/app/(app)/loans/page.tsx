'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  History,
  Landmark,
  Loader2,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import {
  ToolbarFiltersPortal,
  useRegisterToolbarActions,
} from '@/context/toolbar-actions-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  applyLoanPaymentAction,
  batchUpdateLoanPayments,
  createLoan,
  deleteLoan,
  listLoans,
  updateLoan,
} from '@/lib/api/loans';
import {
  createLender,
  listLenders,
  mergeLenders,
  payLender,
  splitLender,
  undoLenderPayment,
} from '@/lib/api/lenders';
import type { PayLenderInput } from '@/schemas/lender.schema';
import LenderPayDialog from '@/components/loans/LenderPayDialog';
import { LenderGroupedLoansTable } from '@/components/loans/LenderGroupedLoansTable';
import { LenderOrganizeDialog } from '@/components/loans/LenderOrganizeDialog';
import { LoanCalendarPaymentOverlay } from '@/components/loans/LoanCalendarPaymentOverlay';
import { LoanCreateOverlay } from '@/components/loans/LoanCreateOverlay';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { inferLenderProviderIconKey } from '@/lib/finance/lender-identity';
import {
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import {
  isValidCalendarDateString,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import type { PaymentMethodOption, IncomeTemplateListItem } from '@/types/catalog';
import {
  createLoanSchema,
  type CreateLoanInput,
  type UpdateLoanInput,
} from '@/schemas/loan.schema';
import type { LenderListItem } from '@/types/lenders';
import type {
  LoanListItem,
  LoanPaymentActionValue,
  LoanPaymentListItem,
} from '@/types/loans';

type LoanFormState = {
  name: string;
  lender: string;
  lenderId: string;
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

const NO_PAYMENT_WALLET_VALUE = 'none';

const defaultStartDate = () => todayCalendarDate();

const defaultForm = (): LoanFormState => ({
  name: '',
  lender: '',
  lenderId: '',
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
  'lenderId',
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
      ? `Se descuenta del ingreso · ${loan.incomeTemplateName}`
      : 'Se descuenta del ingreso';
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
  if (status === 'overdue') return 'Vencida';
  return 'Por pagar';
};

const paymentActionLabel = (action: LoanPaymentActionValue) => {
  if (action === 'MARK_PAID') return 'Confirmar pago';
  if (action === 'MARK_PAID_EXTERNAL') return 'Registrar pago histórico';
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
      ? 'Se marcará como pagado. Si eliges billetera, se generará un gasto vinculado contra esa billetera.'
      : 'Se marcará como pagado y se generará el gasto vinculado contra la billetera seleccionada.';
  }
  if (action === 'MARK_PAID_EXTERNAL') {
    return 'Se marcará como pagado sin descontar de ninguna billetera ni crear un gasto. Úsalo cuando el pago ya se hizo fuera de MiCasa (banco, Mercado Libre, etc.).';
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

const mapLoanFormIssues = <T extends string>(
  issues: Array<{ path: PropertyKey[]; message: string }>,
  fieldKeys: ReadonlySet<T>,
): Partial<Record<T | 'general', string>> => {
  const byField: Partial<Record<T | 'general', string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && fieldKeys.has(key as T)) {
      byField[key as T] = issue.message;
      continue;
    }
    byField.general = issue.message;
  }
  return byField;
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
      row: 'border-emerald-500/25 bg-emerald-500/5',
      badge:
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      iconBox:
        'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300',
    };
  }
  if (status === 'overdue') {
    return {
      icon: AlertTriangle,
      row: 'border-destructive/30 bg-destructive/5',
      badge: 'border-destructive/40 bg-destructive/10 text-destructive',
      iconBox: 'bg-destructive/10 text-destructive ring-destructive/30',
    };
  }
  if (status === 'skipped') {
    return {
      icon: CircleSlash,
      row: 'border-slate-400/25 bg-slate-500/5',
      badge:
        'border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
      iconBox:
        'bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-300',
    };
  }
  if (status === 'cancelled') {
    return {
      icon: CircleSlash,
      row: 'border-rose-500/25 bg-rose-500/5',
      badge: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      iconBox: 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-300',
    };
  }
  return {
    icon: Clock,
    row: 'border-amber-500/25 bg-amber-500/5',
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

type BatchPaymentDraft = {
  action: 'MARK_PAID' | 'MARK_PAID_EXTERNAL';
  paymentIds: number[];
  paidAt: string;
  sourceWalletId: string;
  note: string;
};

export default function LoansPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { context } = useFinanceContext();
  const todayYmd = useHydrationSafeTodayYmd();
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [lenders, setLenders] = useState<LenderListItem[]>([]);
  const [wallets, setWallets] = useState<PaymentMethodOption[]>([]);
  const [incomeTemplates, setIncomeTemplates] = useState<IncomeTemplateListItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter>('ALL');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<LoanFormState>(() => defaultForm());
  const [formErrors, setFormErrors] = useState<LoanFormErrors>({});
  const [batchMonth, setBatchMonth] = useState(() => {
    const [year, month] = todayCalendarDate().split('-').map(Number);
    return { year, month };
  });
  const [batchDraft, setBatchDraft] = useState<BatchPaymentDraft | null>(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [payLenderId, setPayLenderId] = useState<number | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [organizeLenderId, setOrganizeLenderId] = useState<number | null>(null);
  const [organizeMode, setOrganizeMode] = useState<'merge' | 'split'>('merge');
  const [organizeSubmitting, setOrganizeSubmitting] = useState(false);
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [newLenderOpen, setNewLenderOpen] = useState(false);
  const [newLenderName, setNewLenderName] = useState('');
  const [newLenderSubmitting, setNewLenderSubmitting] = useState(false);

  const resetLoanDetailDrafts = useCallback(() => {
    setPaymentActionDraft(null);
    setPaymentActionErrors({});
    setLoanEditOpen(false);
    setLoanEditForm(null);
    setLoanEditErrors({});
    setLifecycleDraft(null);
    setDeleteDialogOpen(false);
    setDeleteError(null);
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

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (context.type === 'user' && context.id === 0) {
      setLoading(false);
      return;
    }
    if (!options?.silent) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const [loanData, lenderData, walletData, templateData] = await Promise.all([
        listLoans(context),
        listLenders(context),
        getPaymentMethodOptions(context),
        clientFetchFromApi<IncomeTemplateListItem[]>(
          '/api/income-templates',
          undefined,
          context,
        ),
      ]);
      setLoans(loanData);
      setLenders(lenderData);
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
    const lenderIdParam = searchParams.get('lenderId');
    if (!lenderIdParam) return;
    const lenderId = Number(lenderIdParam);
    if (!Number.isInteger(lenderId) || lenderId <= 0) return;
    const lender = lenders.find((item) => item.id === lenderId);
    if (!lender?.payWindow.canPay) return;
    setPayLenderId(lenderId);
  }, [lenders, searchParams]);

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
  const paymentActionPayment = paymentActionDraft
    ? selectedLoanPayments.find(
        (payment) => payment.id === paymentActionDraft.paymentId,
      ) ?? null
    : null;
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

  const createLoanFromForm = async () => {
    if (isSubmitting) return;
    if (form.paymentSource === 'WALLET' && !form.sourceWalletId) {
      setFormErrors({ sourceWalletId: 'Selecciona una billetera de origen' });
      return;
    }
    const parsed = createLoanSchema.safeParse({
      name: form.name,
      lender: form.lender,
      lenderId: form.lenderId || null,
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
      setFormErrors(mapLoanFormIssues(parsed.error.issues, loanFormErrorFields));
      return;
    }

    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  };

  const payingLender = useMemo(
    () => lenders.find((lender) => lender.id === payLenderId) ?? null,
    [lenders, payLenderId],
  );

  const organizeLender = useMemo(
    () => lenders.find((lender) => lender.id === organizeLenderId) ?? null,
    [lenders, organizeLenderId],
  );

  const handleMergeLender = async (targetLenderId: number) => {
    if (!organizeLenderId) return;
    setOrganizeSubmitting(true);
    setOrganizeError(null);
    try {
      await mergeLenders(organizeLenderId, { targetLenderId }, context);
      toast.success('Prestamistas fusionados');
      setOrganizeLenderId(null);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo fusionar';
      setOrganizeError(message);
    } finally {
      setOrganizeSubmitting(false);
    }
  };

  const handleSplitLender = async (input: {
    loanIds: number[];
    targetLenderId: number | null;
    name: string | null;
  }) => {
    if (!organizeLenderId) return;
    setOrganizeSubmitting(true);
    setOrganizeError(null);
    try {
      await splitLender(
        organizeLenderId,
        {
          loanIds: input.loanIds,
          targetLenderId: input.targetLenderId,
          name: input.name,
        },
        context,
      );
      toast.success('Contratos separados');
      setOrganizeLenderId(null);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo separar';
      setOrganizeError(message);
    } finally {
      setOrganizeSubmitting(false);
    }
  };

  const handlePayLender = async (data: PayLenderInput) => {
    if (!payLenderId) return;
    setPaySubmitting(true);
    setPayError(null);
    try {
      await payLender(payLenderId, data, context);
      toast.success(
        data.mode === 'EXTERNAL'
          ? `Registraste el pago a ${payingLender?.name ?? 'prestamista'}`
          : `Pagaste a ${payingLender?.name ?? 'prestamista'}`,
      );
      setPayLenderId(null);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo registrar el pago';
      setPayError(message);
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleCreateLender = async () => {
    const name = newLenderName.trim();
    if (!name) return;
    setNewLenderSubmitting(true);
    try {
      const providerIconKey = inferLenderProviderIconKey(name);
      const created = await createLender(
        {
          name,
          ...(providerIconKey ? { providerIconKey } : {}),
        },
        context,
      );
      toast.success(`Prestamista ${created.name} creado`);
      setNewLenderOpen(false);
      setNewLenderName('');
      setForm((current) => ({
        ...current,
        lender: created.name,
        lenderId: String(created.id),
      }));
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo crear el prestamista',
      );
    } finally {
      setNewLenderSubmitting(false);
    }
  };

  const visibleLenders = useMemo(() => {
    const visibleIds = new Set(visibleLoans.map((loan) => loan.lenderId));
    return lenders.filter((lender) => {
      const loansForLender = visibleLoans.filter(
        (loan) => loan.lenderId === lender.id,
      );
      if (statusFilter === 'ALL') {
        return loansForLender.length > 0 || lender.loans.length === 0;
      }
      return visibleIds.has(lender.id);
    });
  }, [lenders, statusFilter, visibleLoans]);

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

  const handleDeleteLoan = async () => {
    if (!selectedLoan) return;

    setDeleteError(null);
    try {
      await deleteLoan(selectedLoan.id, context);
      toast.success('Préstamo eliminado');
      setDeleteDialogOpen(false);
      setSelectedLoanId(null);
      resetLoanDetailDrafts();
      clearLoanIdQueryParam();
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo eliminar el préstamo';
      setDeleteError(message);
      toast.error(message);
    }
  };

  const startPaymentAction = (
    payment: LoanPaymentListItem,
    action: LoanPaymentActionValue,
  ) => {
    const defaultWalletId =
      payment.sourceWalletId ??
      selectedLoan?.sourceWalletId ??
      selectedLoan?.linkedWalletId ??
      null;
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
    if (
      paymentActionDraft.action === 'MARK_PAID' ||
      paymentActionDraft.action === 'MARK_PAID_EXTERNAL'
    ) {
      if (!isValidCalendarDateString(paymentActionDraft.paidAt)) {
        errors.paidAt = 'Selecciona una fecha de pago válida.';
      }
      if (
        paymentActionDraft.action === 'MARK_PAID' &&
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
        if (paymentActionDraft.sourceWalletId) {
          payload.sourceWalletId = Number(paymentActionDraft.sourceWalletId);
        }
      }

      if (paymentActionDraft.action === 'MARK_PAID_EXTERNAL') {
        payload.paidAt = paymentActionDraft.paidAt;
      }

      await applyLoanPaymentAction(paymentActionDraft.paymentId, payload, context);
      const action = paymentActionDraft.action;
      toast.success(`${paymentActionLabel(action)} aplicado`);
      if (action === 'MARK_PAID' || action === 'MARK_PAID_EXTERNAL') {
        setSelectedLoanId(null);
        resetLoanDetailDrafts();
        clearLoanIdQueryParam();
      } else {
        setPaymentActionDraft(null);
        setPaymentActionErrors({});
      }
      await loadData({ silent: true });
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

  const monthScheduledPayments = useMemo(() => {
    const monthPrefix = `${batchMonth.year}-${String(batchMonth.month).padStart(2, '0')}`;
    const items: Array<{ payment: LoanPaymentListItem; loan: LoanListItem }> = [];
    for (const loan of activeLoans) {
      for (const payment of loan.payments ?? []) {
        if (payment.status !== 'SCHEDULED') continue;
        if (!payment.dueDate.startsWith(monthPrefix)) continue;
        items.push({ payment, loan });
      }
    }
    return items.sort((a, b) =>
      a.payment.dueDate.localeCompare(b.payment.dueDate),
    );
  }, [activeLoans, batchMonth.month, batchMonth.year]);

  const batchMonthLabel = useMemo(
    () =>
      new Date(batchMonth.year, batchMonth.month - 1, 1).toLocaleDateString(
        'es-MX',
        { month: 'long', year: 'numeric' },
      ),
    [batchMonth.month, batchMonth.year],
  );

  const batchSelectedTotal = useMemo(() => {
    if (!batchDraft) return 0;
    const selected = new Set(batchDraft.paymentIds);
    return monthScheduledPayments
      .filter((row) => selected.has(row.payment.id))
      .reduce((sum, row) => sum + row.payment.amount, 0);
  }, [batchDraft, monthScheduledPayments]);

  const handleOpenBatchDraft = useCallback(
    (action: 'MARK_PAID' | 'MARK_PAID_EXTERNAL') => {
      setBatchError(null);
      setBatchDraft({
        action,
        paymentIds: monthScheduledPayments.map((row) => row.payment.id),
        paidAt: todayYmd,
        sourceWalletId: '',
        note: '',
      });
    },
    [monthScheduledPayments, todayYmd],
  );

  const openCreateLoan = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const openNewLender = useCallback(() => {
    setNewLenderName('');
    setNewLenderOpen(true);
  }, []);

  const handleClearStatusFilter = useCallback(() => {
    setStatusFilter('ALL');
  }, []);

  const statusChipCounts = useMemo(() => {
    const counts: Record<LoanStatusFilter, number> = {
      ALL: loans.length,
      ACTIVE: 0,
      PAID_OFF: 0,
      PAUSED: 0,
      CANCELLED: 0,
    };
    for (const loan of loans) {
      counts[loan.status] += 1;
    }
    return counts;
  }, [loans]);

  const primaryActionIcon = useMemo(
    () => <Plus data-icon="inline-start" />,
    [],
  );

  const overflowItems = useMemo(() => {
    const monthName = batchMonthLabel.split(' ')[0];
    const items = [
      {
        key: 'new-lender',
        label: 'Nuevo prestamista',
        onClick: openNewLender,
      },
    ];
    if (monthScheduledPayments.length > 0) {
      items.push(
        {
          key: 'batch-pay',
          label: `Pagar ${monthName} (lote)`,
          onClick: () => handleOpenBatchDraft('MARK_PAID'),
        },
        {
          key: 'batch-paid-external',
          label: `Ya pagado ${monthName} (lote)`,
          onClick: () => handleOpenBatchDraft('MARK_PAID_EXTERNAL'),
        },
      );
    }
    return items;
  }, [
    batchMonthLabel,
    handleOpenBatchDraft,
    monthScheduledPayments.length,
    openNewLender,
  ]);

  useRegisterToolbarActions({
    filters: {
      open: filtersOpen,
      onOpenChange: setFiltersOpen,
      activeCount: statusFilter === 'ALL' ? 0 : 1,
    },
    primaryAction: {
      label: 'Nuevo préstamo',
      onClick: openCreateLoan,
      icon: primaryActionIcon,
    },
    overflow: { items: overflowItems },
  });

  const handleBatchSubmit = async () => {
    if (!batchDraft) return;
    if (batchDraft.paymentIds.length === 0) {
      setBatchError('Selecciona al menos una cuota');
      return;
    }
    if (
      batchDraft.action === 'MARK_PAID' &&
      monthScheduledPayments.some(
        (row) =>
          batchDraft.paymentIds.includes(row.payment.id) &&
          row.loan.paymentSource === 'WALLET',
      ) &&
      !batchDraft.sourceWalletId
    ) {
      setBatchError('Selecciona la billetera que pagará el lote');
      return;
    }

    try {
      setBatchSubmitting(true);
      setBatchError(null);
      await batchUpdateLoanPayments(
        {
          paymentIds: batchDraft.paymentIds,
          action: batchDraft.action,
          paidAt: batchDraft.paidAt,
          sourceWalletId: batchDraft.sourceWalletId
            ? Number(batchDraft.sourceWalletId)
            : undefined,
          note: batchDraft.note.trim() || undefined,
        },
        context,
      );
      toast.success(
        batchDraft.action === 'MARK_PAID'
          ? `Pagaste ${batchDraft.paymentIds.length} cuota(s) de ${batchMonthLabel}`
          : `Registraste ${batchDraft.paymentIds.length} pago(s) históricos de ${batchMonthLabel}`,
      );
      setBatchDraft(null);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo completar el lote';
      setBatchError(message);
      toast.error(message);
    } finally {
      setBatchSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolbarFiltersPortal>
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estado
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar préstamos por estado"
            >
              {loanStatusFilters.map((filter) => {
                const count = statusChipCounts[filter.value];
                const isSelected = statusFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setStatusFilter(filter.value)}
                    className={cn(
                      'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {filter.label}{' '}
                    <span className="tabular-nums opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          {statusFilter !== 'ALL' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-fit shrink-0 text-muted-foreground"
              onClick={handleClearStatusFilter}
              aria-label="Limpiar filtro de estado"
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </ToolbarFiltersPortal>

      {loading ? (
        <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden')}>
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden data-icon="inline-start" />
            Cargando préstamos...
          </div>
        </div>
      ) : loadError ? (
        <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden')}>
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <AlertTriangle className="h-5 w-5" aria-hidden data-icon="inline-start" />
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
        </div>
      ) : loans.length === 0 ? (
        <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden')}>
          <EmptyState
            message="No tienes préstamos registrados."
            description="Crea un préstamo para ver sus pagos en el inicio."
            action={{
              label: 'Crear préstamo',
              onClick: openCreateLoan,
            }}
          />
        </div>
      ) : visibleLoans.length === 0 ? (
        <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden')}>
          <EmptyState
            message="No hay préstamos en este filtro."
            description="Cambia el estado seleccionado para revisar el resto del historial."
          />
        </div>
      ) : (
        <LenderGroupedLoansTable
          lenders={visibleLenders}
          loans={visibleLoans}
          onOpenLoan={(loanId) => {
            resetLoanDetailDrafts();
            setSelectedLoanId(loanId);
          }}
          onPayLender={(lenderId) => {
            setPayError(null);
            setPayLenderId(lenderId);
          }}
          onMergeLender={(lenderId) => {
            setOrganizeError(null);
            setOrganizeMode('merge');
            setOrganizeLenderId(lenderId);
          }}
          onSplitLender={(lenderId) => {
            setOrganizeError(null);
            setOrganizeMode('split');
            setOrganizeLenderId(lenderId);
          }}
          onUndoLastPayment={(lenderId, paymentId) => {
            void undoLenderPayment(lenderId, paymentId, context)
              .then(async () => {
                toast.success('Se deshizo el pago consolidado');
                await loadData();
              })
              .catch((error: unknown) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'No se pudo deshacer el pago',
                );
              });
          }}
        />
      )}

      <LoanCreateOverlay
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormErrors({});
        }}
        form={form}
        errors={formErrors}
        lenders={lenders}
        fundingWallets={fundingWallets}
        wallets={wallets}
        incomeTemplates={incomeTemplates}
        submitting={isSubmitting}
        onSubmit={() => void createLoanFromForm()}
        onFieldChange={setField}
        onLenderSelect={(lenderId, lenderName) => {
          setForm((current) => ({
            ...current,
            lenderId,
            lender: lenderName,
          }));
          setFormErrors((current) => ({
            ...current,
            lender: undefined,
            lenderId: undefined,
          }));
        }}
        onNewLender={() => setField('lenderId', '')}
      />
      <ResponsiveOverlay
        open={selectedLoan !== null && paymentActionDraft === null}
        onOpenChange={(open) => {
          if (!open) {
            if (paymentActionDraft) return;
            setSelectedLoanId(null);
            resetLoanDetailDrafts();
            clearLoanIdQueryParam();
          }
        }}
        title={selectedLoan?.name ?? 'Préstamo'}
        description={
          selectedLoan
            ? `${selectedLoan.lender} · ${typeLabel(selectedLoan.type)} · ${frequencyLabel(selectedLoan.frequency)}`
            : 'Detalle del préstamo'
        }
        busy={loanEditSubmitting || lifecycleSubmitting}
        contentClassName="sm:max-w-3xl lg:max-w-[52rem] sm:max-h-[min(92dvh,44rem)] sm:overflow-y-auto"
      >
        {({ handleSelectOpenChange }) =>
        selectedLoan ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
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
                <span className="text-xs text-muted-foreground">
                  {selectedLoan.lender} · {typeLabel(selectedLoan.type)} ·{' '}
                  {frequencyLabel(selectedLoan.frequency)}
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <aside className="space-y-3 lg:sticky lg:top-0 lg:max-h-[calc(min(92dvh,44rem)-5.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
                  <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'p-3')}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Acciones
                    </p>
                    <div className="mt-2 flex items-center gap-2 md:hidden">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 min-w-0 flex-1 justify-center gap-1.5 rounded-xl"
                        onClick={() => startLoanEdit(selectedLoan)}
                        disabled={loanEditSubmitting || lifecycleSubmitting}
                      >
                        <Pencil
                          className="h-3.5 w-3.5"
                          aria-hidden
                          data-icon="inline-start"
                        />
                        Editar
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            aria-label="Más acciones del préstamo"
                            disabled={
                              loanEditSubmitting || lifecycleSubmitting
                            }
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {selectedLoan.status === 'ACTIVE' ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setLoanEditOpen(false);
                                setLifecycleDraft('PAUSED');
                                setLoanEditErrors({});
                              }}
                            >
                              <Pause className="h-4 w-4" />
                              Pausar
                            </DropdownMenuItem>
                          ) : null}
                          {selectedLoan.status === 'PAUSED' ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setLoanEditOpen(false);
                                setLifecycleDraft('ACTIVE');
                                setLoanEditErrors({});
                              }}
                            >
                              <Play className="h-4 w-4" />
                              Reanudar
                            </DropdownMenuItem>
                          ) : null}
                          {selectedLoan.status === 'ACTIVE' ||
                          selectedLoan.status === 'PAUSED' ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setLoanEditOpen(false);
                                setLifecycleDraft('CANCELLED');
                                setLoanEditErrors({});
                              }}
                            >
                              <CircleSlash className="h-4 w-4" />
                              Cancelar
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setLoanEditOpen(false);
                              setLifecycleDraft(null);
                              setLoanEditErrors({});
                              setDeleteError(null);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 hidden grid-cols-2 gap-2 md:grid">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-w-0 justify-center gap-1.5 px-2"
                        onClick={() => startLoanEdit(selectedLoan)}
                        disabled={loanEditSubmitting || lifecycleSubmitting}
                      >
                        <Pencil
                          className="h-3.5 w-3.5"
                          aria-hidden
                          data-icon="inline-start"
                        />
                        Editar
                      </Button>
                      {selectedLoan.status === 'ACTIVE' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-w-0 justify-center gap-1.5 px-2"
                          onClick={() => {
                            setLoanEditOpen(false);
                            setLifecycleDraft('PAUSED');
                            setLoanEditErrors({});
                          }}
                          disabled={loanEditSubmitting || lifecycleSubmitting}
                        >
                          <Pause
                            className="h-3.5 w-3.5"
                            aria-hidden
                            data-icon="inline-start"
                          />
                          Pausar
                        </Button>
                      ) : null}
                      {selectedLoan.status === 'PAUSED' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-w-0 justify-center gap-1.5 px-2"
                          onClick={() => {
                            setLoanEditOpen(false);
                            setLifecycleDraft('ACTIVE');
                            setLoanEditErrors({});
                          }}
                          disabled={loanEditSubmitting || lifecycleSubmitting}
                        >
                          <Play
                            className="h-3.5 w-3.5"
                            aria-hidden
                            data-icon="inline-start"
                          />
                          Reanudar
                        </Button>
                      ) : null}
                      {selectedLoan.status === 'ACTIVE' ||
                      selectedLoan.status === 'PAUSED' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-w-0 justify-center gap-1.5 px-2 text-destructive hover:text-destructive"
                          onClick={() => {
                            setLoanEditOpen(false);
                            setLifecycleDraft('CANCELLED');
                            setLoanEditErrors({});
                          }}
                          disabled={loanEditSubmitting || lifecycleSubmitting}
                          aria-label="Cancelar préstamo"
                        >
                          <CircleSlash
                            className="h-3.5 w-3.5"
                            aria-hidden
                            data-icon="inline-start"
                          />
                          Cancelar
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-w-0 justify-center gap-1.5 px-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          setLoanEditOpen(false);
                          setLifecycleDraft(null);
                          setLoanEditErrors({});
                          setDeleteError(null);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={
                          loanEditSubmitting ||
                          lifecycleSubmitting ||
                          paymentActionSubmitting
                        }
                        aria-label="Eliminar préstamo"
                      >
                        <Trash2
                          className="h-3.5 w-3.5"
                          aria-hidden
                          data-icon="inline-start"
                        />
                        Eliminar
                      </Button>
                    </div>
                  </section>

                  <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'p-4')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Saldo pendiente
                        </p>
                        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">
                          {formatCurrency(selectedLoan.remainingAmount)}
                        </p>
                      </div>
                      <span className={MONTHLY_ICON_PILL_CLASS}>
                        <Landmark className="h-4 w-4" aria-hidden data-icon="inline-start" />
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

                    <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pagado
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(selectedLoan.paidAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Total
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatCurrency(selectedLoan.totalPayable)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pago
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatCurrency(selectedLoan.paymentAmount)}
                        </p>
                      </div>
                      <div>
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

                  {lifecycleDraft ? (
                    <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'p-3')}>
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
                            <Play className="h-4 w-4" aria-hidden data-icon="inline-start" />
                          ) : lifecycleDraft === 'PAUSED' ? (
                            <Pause className="h-4 w-4" aria-hidden data-icon="inline-start" />
                          ) : (
                            <CircleSlash className="h-4 w-4" aria-hidden data-icon="inline-start" />
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
                              aria-hidden data-icon="inline-start" />
                          ) : null}
                          Aplicar
                        </Button>
                      </div>
                    </section>
                  ) : null}
                </aside>

                <section className="min-w-0 space-y-4">
                  {loanEditOpen && loanEditForm ? (
                    <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'p-4')}>
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
                            aria-describedby={
                              loanEditErrors.name
                                ? `loan-${selectedLoan.id}-edit-name-error`
                                : undefined
                            }
                            className={cn(
                              loanEditErrors.name &&
                                'border-destructive focus-visible:ring-destructive/30',
                            )}
                          />
                          {loanEditErrors.name ? (
                            <p
                              id={`loan-${selectedLoan.id}-edit-name-error`}
                              className="text-xs text-destructive"
                              role="alert"
                            >
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
                            aria-describedby={
                              loanEditErrors.lender
                                ? `loan-${selectedLoan.id}-edit-lender-error`
                                : undefined
                            }
                            className={cn(
                              loanEditErrors.lender &&
                                'border-destructive focus-visible:ring-destructive/30',
                            )}
                          />
                          {loanEditErrors.lender ? (
                            <p
                              id={`loan-${selectedLoan.id}-edit-lender-error`}
                              className="text-xs text-destructive"
                              role="alert"
                            >
                              {loanEditErrors.lender}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cuenta relacionada</Label>
                          <Select
                            value={loanEditForm.linkedWalletId}
                            onOpenChange={handleSelectOpenChange}
                            onValueChange={(value) =>
                              setLoanEditField('linkedWalletId', value)
                            }
                          >
                            <SelectTrigger
                              aria-label="Cuenta relacionada para seguimiento"
                              className={cn(
                                loanEditErrors.linkedWalletId &&
                                  'border-destructive focus:ring-destructive/30',
                              )}
                              aria-invalid={Boolean(loanEditErrors.linkedWalletId)}
                              aria-describedby={
                                loanEditErrors.linkedWalletId
                                  ? `loan-${selectedLoan.id}-edit-linked-wallet-error`
                                  : undefined
                              }
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
                            <p
                              id={`loan-${selectedLoan.id}-edit-linked-wallet-error`}
                              className="text-xs text-destructive"
                              role="alert"
                            >
                              {loanEditErrors.linkedWalletId}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Ingreso relacionado</Label>
                          {selectedLoan.paymentSource === 'PAYROLL_DEDUCTION' ? (
                            <Select
                              value={loanEditForm.incomeTemplateId}
                              onOpenChange={handleSelectOpenChange}
                              onValueChange={(value) =>
                                setLoanEditField('incomeTemplateId', value)
                              }
                            >
                              <SelectTrigger
                                aria-label="Ingreso relacionado con la deducción"
                                className={cn(
                                  loanEditErrors.incomeTemplateId &&
                                    'border-destructive focus:ring-destructive/30',
                                )}
                                aria-invalid={Boolean(
                                  loanEditErrors.incomeTemplateId,
                                )}
                                aria-describedby={
                                  loanEditErrors.incomeTemplateId
                                    ? `loan-${selectedLoan.id}-edit-income-template-error`
                                    : undefined
                                }
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
                          {selectedLoan.paymentSource === 'PAYROLL_DEDUCTION' ? (
                            <p className="text-[11px] text-muted-foreground">
                              Opcional. Vincular una plantilla de ingreso mejora
                              las etiquetas en el inicio y obligaciones
                              próximas («Nómina: …»).
                            </p>
                          ) : null}
                          {loanEditErrors.incomeTemplateId ? (
                            <p
                              id={`loan-${selectedLoan.id}-edit-income-template-error`}
                              className="text-xs text-destructive"
                              role="alert"
                            >
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
                              aria-hidden data-icon="inline-start" />
                          ) : (
                            <Save className="h-4 w-4" aria-hidden data-icon="inline-start" />
                          )}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden')}>
                    <div className="border-b border-border/60 p-3 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-foreground">
                            Calendario de pagos
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {selectedLoan.overduePayment
                              ? `Vencida: ${formatDate(selectedLoan.overduePayment.dueDate)}`
                              : null}
                            {selectedLoan.overduePayment && selectedLoan.nextPayment
                              ? ' · '
                              : null}
                            {selectedLoan.nextPayment
                              ? `Próximo: ${formatDate(selectedLoan.nextPayment.dueDate)}`
                              : selectedLoan.overduePayment
                                ? null
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
                            ['overdue', 'Vencidas'],
                            ['scheduled', 'Por pagar'],
                            ['paid', 'Pagados'],
                            ['skipped', 'Omitidos'],
                            ['cancelled', 'Cancelados'],
                          ] satisfies Array<[LoanPaymentVisualStatus, string]>
                        ).map(([status, label]) => (
                          <span
                            key={status}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {label}
                            <span className="font-mono font-semibold tabular-nums text-foreground">
                              {selectedScheduleCounts[status]}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-0">
                      {selectedLoanPayments.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Este préstamo todavía no tiene pagos programados.
                        </div>
                      ) : (
                        <>
                        <ul
                          className="divide-y divide-border/50 px-3 md:hidden"
                          role="list"
                        >
                          {selectedLoanPayments.map((payment) => {
                            const visualStatus = getPaymentVisualStatus(
                              payment,
                              todayYmd,
                            );
                            const tone = paymentStatusTone(visualStatus);
                            const StatusIcon = tone.icon;
                            const isPayrollDeductionLoan =
                              selectedLoan.paymentSource === 'PAYROLL_DEDUCTION';
                            const originShort = isPayrollDeductionLoan
                              ? selectedLoan.incomeTemplateName ?? 'Nómina'
                              : payment.sourceWalletName ??
                                selectedLoan.sourceWalletName ??
                                'Billetera';
                            return (
                              <li
                                key={`m-${payment.id}`}
                                className={cn(
                                  'flex items-center gap-2.5 py-2',
                                  visualStatus === 'paid' && 'opacity-80',
                                  visualStatus === 'cancelled' && 'opacity-60',
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
                                    tone.iconBox,
                                  )}
                                  aria-hidden
                                >
                                  <StatusIcon className="h-3.5 w-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium leading-tight text-foreground">
                                    {formatDate(payment.dueDate)}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                                    #{payment.sequence} ·{' '}
                                    {paymentStatusLabel(visualStatus)} ·{' '}
                                    {originShort}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className="font-mono text-sm font-semibold tabular-nums leading-none">
                                    {formatCurrency(payment.amount)}
                                  </span>
                                  {payment.status === 'SCHEDULED' ? (
                                    <div className="flex items-center gap-0.5">
                                      {isPayrollDeductionLoan ? (
                                        <span className="max-w-[7.5rem] text-right text-[10px] leading-tight text-muted-foreground">
                                          Se descuenta del ingreso
                                        </span>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-7 rounded-lg px-2 text-[11px]"
                                          onClick={() =>
                                            startPaymentAction(
                                              payment,
                                              'MARK_PAID',
                                            )
                                          }
                                          disabled={paymentActionSubmitting}
                                        >
                                          Pagar
                                        </Button>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            aria-label={`Más acciones para el pago ${payment.sequence}`}
                                            disabled={paymentActionSubmitting}
                                          >
                                            <MoreVertical className="h-3.5 w-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          align="end"
                                          className="w-44"
                                        >
                                          <DropdownMenuItem
                                            disabled={paymentActionSubmitting}
                                            onClick={() =>
                                              startPaymentAction(
                                                payment,
                                                'MARK_PAID_EXTERNAL',
                                              )
                                            }
                                          >
                                            <History className="h-4 w-4" />
                                            Ya pagado
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            disabled={paymentActionSubmitting}
                                            onClick={() =>
                                              startPaymentAction(
                                                payment,
                                                'SKIP',
                                              )
                                            }
                                          >
                                            <CircleSlash className="h-4 w-4" />
                                            Omitir
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            variant="destructive"
                                            disabled={paymentActionSubmitting}
                                            onClick={() =>
                                              startPaymentAction(
                                                payment,
                                                'CANCEL',
                                              )
                                            }
                                          >
                                            <CircleSlash className="h-4 w-4" />
                                            Cancelar
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  ) : null}
                                  {payment.status === 'PAID' ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-1.5 text-[11px] text-muted-foreground"
                                      onClick={() =>
                                        startPaymentAction(
                                          payment,
                                          'MARK_SCHEDULED',
                                        )
                                      }
                                      disabled={paymentActionSubmitting}
                                      aria-label={`Deshacer pago ${payment.sequence}`}
                                    >
                                      <Undo2 className="h-3.5 w-3.5" aria-hidden />
                                      Deshacer
                                    </Button>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Vence</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Origen</TableHead>
                              <TableHead className="text-right">Monto</TableHead>
                              <TableHead className="text-right">
                                <span className="sr-only">Acciones</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedLoanPayments.map((payment) => {
                            const visualStatus = getPaymentVisualStatus(
                              payment,
                              todayYmd,
                            );
                            const tone = paymentStatusTone(visualStatus);
                            const isPayrollDeductionLoan =
                              selectedLoan.paymentSource === 'PAYROLL_DEDUCTION';
                            const originShort = isPayrollDeductionLoan
                              ? selectedLoan.incomeTemplateName ?? 'Nómina'
                              : payment.sourceWalletName ??
                                selectedLoan.sourceWalletName ??
                                'Billetera';

                            return (
                              <TableRow
                                key={payment.id}
                                className={cn(
                                    visualStatus === 'paid' &&
                                      'bg-muted/20 opacity-90',
                                    visualStatus === 'overdue' &&
                                      'bg-destructive/5',
                                  )}
                                >
                                  <TableCell className="font-medium tabular-nums">
                                    {payment.sequence}
                                  </TableCell>
                                  <TableCell className="whitespace-normal">
                                    <span className="block text-foreground">
                                      {formatDate(payment.dueDate)}
                                    </span>
                                    {payment.paidAt ? (
                                      <span className="text-[10px] text-muted-foreground">
                                        Pagado {formatDate(payment.paidAt)}
                                      </span>
                                    ) : null}
                                    {payment.note ? (
                                      <span className="mt-0.5 block text-[10px] text-foreground/80">
                                        {payment.note}
                                      </span>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="whitespace-normal">
                                    <span
                                      className={cn(
                                        'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-wider',
                                        tone.badge,
                                      )}
                                    >
                                      {paymentStatusLabel(visualStatus)}
                                    </span>
                                    {payment.linkedExpenseId ? (
                                      <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <ReceiptText
                                          className="h-3 w-3"
                                          aria-hidden
                                          data-icon="inline-start"
                                        />
                                        Gasto #{payment.linkedExpenseId}
                                      </span>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="min-w-[6.5rem] max-w-[11rem] whitespace-normal text-muted-foreground">
                                    {originShort}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className="font-mono text-sm font-semibold tabular-nums">
                                      {formatCurrency(payment.amount)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {payment.status === 'SCHEDULED' ? (
                                      <div className="inline-flex items-center justify-end gap-1">
                                        {isPayrollDeductionLoan ? (
                                          <span className="max-w-[8rem] text-right text-[11px] leading-tight text-muted-foreground">
                                            Se descuenta del ingreso
                                          </span>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1 px-2 text-[11px]"
                                            onClick={() =>
                                              startPaymentAction(
                                                payment,
                                                'MARK_PAID',
                                              )
                                            }
                                            disabled={paymentActionSubmitting}
                                          >
                                            <CheckCircle2
                                              className="h-3 w-3"
                                              aria-hidden
                                              data-icon="inline-start"
                                            />
                                            Pagar
                                          </Button>
                                        )}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              aria-label={`Más acciones para el pago ${payment.sequence}`}
                                              disabled={paymentActionSubmitting}
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuItem
                                              disabled={paymentActionSubmitting}
                                              onClick={() =>
                                                startPaymentAction(
                                                  payment,
                                                  'MARK_PAID_EXTERNAL',
                                                )
                                              }
                                            >
                                              <History className="h-4 w-4" />
                                              Ya pagado
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              disabled={paymentActionSubmitting}
                                              onClick={() =>
                                                startPaymentAction(
                                                  payment,
                                                  'SKIP',
                                                )
                                              }
                                            >
                                              <CircleSlash className="h-4 w-4" />
                                              Omitir
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              variant="destructive"
                                              disabled={paymentActionSubmitting}
                                              onClick={() =>
                                                startPaymentAction(
                                                  payment,
                                                  'CANCEL',
                                                )
                                              }
                                            >
                                              <CircleSlash className="h-4 w-4" />
                                              Cancelar
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    ) : null}
                                    {payment.status === 'PAID' ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1 px-2 text-[11px]"
                                        onClick={() =>
                                          startPaymentAction(
                                            payment,
                                            'MARK_SCHEDULED',
                                          )
                                        }
                                        disabled={paymentActionSubmitting}
                                      >
                                        <Undo2
                                          className="h-3 w-3"
                                          aria-hidden
                                          data-icon="inline-start"
                                        />
                                        Deshacer
                                      </Button>
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                            );
                          })}
                          </TableBody>
                        </Table>
                        </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              </div>
          </div>
        ) : null
        }
      </ResponsiveOverlay>

      <LoanCalendarPaymentOverlay
        open={paymentActionDraft !== null && selectedLoan !== null}
        onOpenChange={(open) => {
          if (!open && !paymentActionSubmitting) {
            setPaymentActionDraft(null);
            setPaymentActionErrors({});
          }
        }}
        loan={selectedLoan}
        payment={paymentActionPayment}
        draft={paymentActionDraft}
        errors={paymentActionErrors}
        submitting={paymentActionSubmitting}
        fundingWallets={fundingWallets}
        onFieldChange={setPaymentActionField}
        onSubmit={() => void handlePaymentActionSubmit()}
      />

      <ResponsiveOverlay
        open={batchDraft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBatchDraft(null);
            setBatchError(null);
          }
        }}
        title={
          batchDraft?.action === 'MARK_PAID'
            ? `Pagar ${batchMonthLabel}`
            : `Ya pagado ${batchMonthLabel}`
        }
        description={
          batchDraft?.action === 'MARK_PAID'
            ? 'Confirma las cuotas y la billetera que pagará el lote.'
            : 'Registra pagos históricos sin mover billeteras ni crear gastos.'
        }
        busy={batchSubmitting}
        contentClassName="sm:max-w-lg"
      >
        {({ handleSelectOpenChange }) => (
          <div className="flex flex-col gap-3">
            {batchError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {batchError}
              </div>
            ) : null}

            <ul className="space-y-1.5" role="list">
              {monthScheduledPayments.map(({ payment, loan }) => {
                const checked =
                  batchDraft?.paymentIds.includes(payment.id) ?? false;
                return (
                  <li key={payment.id}>
                    <label
                      htmlFor={`batch-payment-${payment.id}`}
                      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                    >
                      <Checkbox
                        id={`batch-payment-${payment.id}`}
                        checked={checked}
                        onCheckedChange={(value) => {
                          if (!batchDraft) return;
                          const nextIds =
                            value === true
                              ? [...batchDraft.paymentIds, payment.id]
                              : batchDraft.paymentIds.filter(
                                  (id) => id !== payment.id,
                                );
                          setBatchDraft({ ...batchDraft, paymentIds: nextIds });
                        }}
                        disabled={batchSubmitting}
                        className="mt-0.5"
                        aria-label={`Incluir pago de ${loan.name}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {loan.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Vence {formatDate(payment.dueDate)} ·{' '}
                          {formatCurrency(payment.amount)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <p className="font-mono text-sm font-semibold tabular-nums">
              Total {formatCurrency(batchSelectedTotal)}
            </p>

            {batchDraft?.action === 'MARK_PAID' ? (
              <div className={OVERLAY_GROUPED_CARD_CLASS}>
                <GroupedRow label="Billetera">
                  <Select
                    value={batchDraft.sourceWalletId || undefined}
                    onOpenChange={handleSelectOpenChange}
                    onValueChange={(value) =>
                      setBatchDraft({
                        ...batchDraft,
                        sourceWalletId: value,
                      })
                    }
                    disabled={batchSubmitting}
                  >
                    <SelectTrigger
                      aria-label="Billetera de pago"
                      className={OVERLAY_ROW_TRIGGER_CLASS}
                    >
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {fundingWallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={String(wallet.id)}>
                          {wallet.name}
                          {wallet.amount != null
                            ? ` · ${formatCurrency(wallet.amount)}`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </GroupedRow>
              </div>
            ) : null}

            <DateStepper
              value={batchDraft?.paidAt ?? todayYmd}
              onChange={(next) => {
                if (!batchDraft) return;
                setBatchDraft({ ...batchDraft, paidAt: next });
              }}
            />

            <Textarea
              id="batch-note"
              value={batchDraft?.note ?? ''}
              onChange={(event) => {
                if (!batchDraft) return;
                setBatchDraft({ ...batchDraft, note: event.target.value });
              }}
              disabled={batchSubmitting}
              rows={2}
              placeholder="Nota (opcional)"
            />

            <Button
              type="button"
              onClick={() => void handleBatchSubmit()}
              disabled={batchSubmitting}
              className={OVERLAY_PRIMARY_BUTTON_CLASS}
            >
              {batchSubmitting ? 'Guardando…' : 'Confirmar lote'}
            </Button>
          </div>
        )}
      </ResponsiveOverlay>

      <LenderPayDialog
        open={payLenderId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPayLenderId(null);
            setPayError(null);
          }
        }}
        lender={payingLender}
        fundingWalletOptions={fundingWallets}
        submitting={paySubmitting}
        error={payError}
        onConfirm={handlePayLender}
      />

      <LenderOrganizeDialog
        open={organizeLenderId !== null}
        mode={organizeMode}
        lender={organizeLender}
        lenders={lenders}
        loans={loans}
        submitting={organizeSubmitting}
        error={organizeError}
        onOpenChange={(open) => {
          if (!open) {
            setOrganizeLenderId(null);
            setOrganizeError(null);
          }
        }}
        onMerge={handleMergeLender}
        onSplit={handleSplitLender}
      />

      <ResponsiveOverlay
        open={newLenderOpen}
        onOpenChange={(open) => {
          setNewLenderOpen(open);
          if (!open) setNewLenderName('');
        }}
        title="Nuevo prestamista"
        description="Identidad a la que le debes. Luego puedes agregar contratos debajo."
        busy={newLenderSubmitting}
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateLender();
          }}
        >
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Nombre">
              <Input
                id="new-lender-name"
                value={newLenderName}
                onChange={(event) => setNewLenderName(event.target.value)}
                placeholder="Mercado Libre, FONACOT…"
                className={OVERLAY_ROW_TRIGGER_CLASS}
              />
            </GroupedRow>
          </div>
          <Button
            type="submit"
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
            disabled={newLenderSubmitting || !newLenderName.trim()}
          >
            {newLenderSubmitting ? 'Creando…' : 'Crear prestamista'}
          </Button>
        </form>
      </ResponsiveOverlay>

      <ConfirmDeleteDialog
        open={deleteDialogOpen && selectedLoan !== null}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteError(null);
        }}
        onConfirm={handleDeleteLoan}
        title="Eliminar préstamo"
        description="Esto eliminará el préstamo, su calendario de pagos y los gastos generados por pagos de este préstamo. Los saldos afectados se revertirán."
        itemName={
          selectedLoan
            ? `${selectedLoan.name} · ${formatCurrency(selectedLoan.remainingAmount)} pendiente`
            : undefined
        }
        error={deleteError}
        confirmLabel="Eliminar préstamo"
        loadingLabel="Eliminando préstamo..."
      />
    </div>
  );
}
