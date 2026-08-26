'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { ToggleField } from '@/components/ui/toggle';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import type { FinanceContextType } from '@/types/finance-context';
import type { CategoryOption, CreditCardListItem } from '@/types/catalog';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { createCreditCardPurchase } from '@/lib/api/credit-cards';
import { Skeleton } from '@/components/ui/skeleton';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn, formatCurrency } from '@/lib/utils';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';

type FortnightPeriod = 'FIRST' | 'SECOND';

type FortnightCatalogItem = {
  id: number;
  name: string;
  year: number;
  month: number;
  period: FortnightPeriod;
  active: boolean;
};

const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

const periodForDay = (day: number): FortnightPeriod =>
  day <= 15 ? 'FIRST' : 'SECOND';

const fortnightSortKey = (f: FortnightCatalogItem): number =>
  f.year * 1000 + f.month * 10 + (f.period === 'FIRST' ? 0 : 1);

const sortFortnights = (
  items: FortnightCatalogItem[],
): FortnightCatalogItem[] =>
  [...items].sort((a, b) => fortnightSortKey(a) - fortnightSortKey(b));

const findFortnightForDate = (
  items: FortnightCatalogItem[],
  ymd: string,
): FortnightCatalogItem | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  const period = periodForDay(d);
  return items.find(
    (f) => f.year === y && f.month === m && f.period === period,
  );
};

const findFortnightByParts = (
  items: FortnightCatalogItem[],
  year: number,
  month: number,
  period: FortnightPeriod,
): FortnightCatalogItem | undefined =>
  items.find(
    (f) => f.year === year && f.month === month && f.period === period,
  );

const shiftMonth = (
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } => {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};

const groupedLabelClass =
  'w-[5.5rem] shrink-0 text-sm font-medium leading-none text-foreground';

const rowTriggerClass =
  'h-11 w-full max-w-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent';

function GroupedRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 px-3 py-1.5">
      <div className="flex min-h-11 items-center gap-3">
        <Label htmlFor={htmlFor} className={groupedLabelClass}>
          {label}
        </Label>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function FortnightMonthStepper({
  year,
  month,
  catalog,
  selectedPeriod,
  onYearMonthChange,
  onPickPeriod,
}: {
  year: number;
  month: number;
  catalog: FortnightCatalogItem[];
  selectedPeriod: FortnightPeriod | null;
  onYearMonthChange: (year: number, month: number) => void;
  onPickPeriod: (period: FortnightPeriod) => void;
}) {
  const first = findFortnightByParts(catalog, year, month, 'FIRST');
  const second = findFortnightByParts(catalog, year, month, 'SECOND');

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Mes anterior"
          onClick={() => {
            const next = shiftMonth(year, month, -1);
            onYearMonthChange(next.year, next.month);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium capitalize text-primary">
          {MONTH_SHORT_ES[month - 1]} {year}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Mes siguiente"
          onClick={() => {
            const next = shiftMonth(year, month, 1);
            onYearMonthChange(next.year, next.month);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant={selectedPeriod === 'FIRST' ? 'default' : 'outline'}
          size="sm"
          className="h-9 rounded-lg text-xs"
          disabled={!first}
          aria-pressed={selectedPeriod === 'FIRST'}
          onClick={() => onPickPeriod('FIRST')}
        >
          1ª quincena
        </Button>
        <Button
          type="button"
          variant={selectedPeriod === 'SECOND' ? 'default' : 'outline'}
          size="sm"
          className="h-9 rounded-lg text-xs"
          disabled={!second}
          aria-pressed={selectedPeriod === 'SECOND'}
          onClick={() => onPickPeriod('SECOND')}
        >
          2ª quincena
        </Button>
      </div>
      {!first && !second ? (
        <p className="text-[10px] text-muted-foreground">
          No hay quincenas creadas para este mes.
        </p>
      ) : null}
    </div>
  );
}

export type CreditCardQuickPurchaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: number;
  context: FinanceContextType;
  onSuccess: () => void | Promise<void>;
  /** From estado de cuenta; avoids an extra fetch when already loaded */
  availableCredit?: number | null;
  creditLimit?: number | null;
  /**
   * When true (e.g. debt was just adjusted to the corte), default the
   * “Ya está en el saldo” toggle ON so catch-up purchases stay ledger-only.
   */
  defaultAlreadyInCardBalance?: boolean;
};

const CreditCardQuickPurchaseDialog = ({
  open,
  onOpenChange,
  creditCardId,
  context,
  onSuccess,
  availableCredit: availableCreditProp,
  creditLimit: creditLimitProp,
  defaultAlreadyInCardBalance = false,
}: CreditCardQuickPurchaseDialogProps) => {
  const isMobile = useIsMobile();
  const nestedSelectOpenRef = useRef(false);
  const blockDismissUntilRef = useRef(0);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [fortnights, setFortnights] = useState<FortnightCatalogItem[]>([]);
  const [fetchedAvailable, setFetchedAvailable] = useState<number | null>(null);
  const [fetchedLimit, setFetchedLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fortnightId, setFortnightId] = useState('');
  const [fortnightManualOverride, setFortnightManualOverride] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => {
    const [y] = todayCalendarDate().split('-').map(Number);
    return y;
  });
  const [pickerMonth, setPickerMonth] = useState(() => {
    const [, m] = todayCalendarDate().split('-').map(Number);
    return m;
  });
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayCalendarDate());
  const [installmentCurrent, setInstallmentCurrent] = useState('');
  const [installmentTotal, setInstallmentTotal] = useState('');
  const [alreadyInCardBalance, setAlreadyInCardBalance] = useState(false);

  const handleSelectOpenChange = (nextOpen: boolean) => {
    nestedSelectOpenRef.current = nextOpen;
    if (!nextOpen) {
      blockDismissUntilRef.current = Date.now() + 500;
    }
  };

  const shouldBlockDismiss = () =>
    nestedSelectOpenRef.current || Date.now() < blockDismissUntilRef.current;

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && shouldBlockDismiss()) return;
    onOpenChange(nextOpen);
  };

  const preventDismissWhileSelectOpen = (event: {
    preventDefault: () => void;
  }) => {
    if (shouldBlockDismiss()) event.preventDefault();
  };

  const syncFortnightFromDate = useCallback(
    (ymd: string, catalog: FortnightCatalogItem[]) => {
      const match = findFortnightForDate(catalog, ymd);
      if (match) {
        setFortnightId(String(match.id));
        return;
      }
      const fallback =
        catalog.find((f) => f.active) ?? sortFortnights(catalog).at(-1);
      setFortnightId(fallback ? String(fallback.id) : '');
    },
    [],
  );

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const needCardFetch =
        availableCreditProp === undefined && creditLimitProp === undefined;
      const cardPromise = needCardFetch
        ? clientFetchFromApi<CreditCardListItem>(
            `/api/credit-cards/${creditCardId}`,
            undefined,
            context,
          )
        : Promise.resolve(null);

      const [cats, fts, cardRow] = await Promise.all([
        clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
        clientFetchFromApi<FortnightCatalogItem[]>(
          '/api/fortnights',
          undefined,
          context,
        ),
        cardPromise,
      ]);
      setCategories(cats);
      setFortnights(fts);
      if (cardRow) {
        setFetchedAvailable(cardRow.available_credit ?? null);
        setFetchedLimit(cardRow.credit_limit ?? null);
      } else {
        setFetchedAvailable(null);
        setFetchedLimit(null);
      }
      const date = todayCalendarDate();
      setFortnightManualOverride(false);
      syncFortnightFromDate(date, fts);
      const match = findFortnightForDate(fts, date);
      if (match) {
        setPickerYear(match.year);
        setPickerMonth(match.month);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar datos',
      );
    } finally {
      setLoading(false);
    }
  }, [
    availableCreditProp,
    context,
    creditCardId,
    creditLimitProp,
    syncFortnightFromDate,
  ]);

  useEffect(() => {
    if (open) {
      setDescription('');
      setAmount('');
      setPaymentDate(todayCalendarDate());
      setInstallmentCurrent('');
      setInstallmentTotal('');
      setCategoryId('');
      setAlreadyInCardBalance(defaultAlreadyInCardBalance);
      setFortnightManualOverride(false);
      setError(null);
      void loadCatalog();
    }
  }, [open, loadCatalog, defaultAlreadyInCardBalance]);

  const dateMatchedFortnight = useMemo(
    () => findFortnightForDate(fortnights, paymentDate),
    [fortnights, paymentDate],
  );

  const selectedFortnight = useMemo(
    () => fortnights.find((f) => String(f.id) === fortnightId),
    [fortnights, fortnightId],
  );

  const selectedPeriodInPicker: FortnightPeriod | null =
    selectedFortnight &&
    selectedFortnight.year === pickerYear &&
    selectedFortnight.month === pickerMonth
      ? selectedFortnight.period
      : null;

  const fortnightMismatchesDate = Boolean(
    fortnightManualOverride &&
      dateMatchedFortnight &&
      String(dateMatchedFortnight.id) !== fortnightId,
  );

  const handlePaymentDateChange = (next: string) => {
    setPaymentDate(next);
    setFortnightManualOverride(false);
    syncFortnightFromDate(next, fortnights);
    const match = findFortnightForDate(fortnights, next);
    if (match) {
      setPickerYear(match.year);
      setPickerMonth(match.month);
    }
  };

  const handlePickPeriod = (period: FortnightPeriod) => {
    const match = findFortnightByParts(
      fortnights,
      pickerYear,
      pickerMonth,
      period,
    );
    if (!match) {
      toast.error('Esa quincena no existe aún');
      return;
    }
    setFortnightManualOverride(true);
    setFortnightId(String(match.id));
  };

  const resolvedLimit =
    creditLimitProp !== undefined ? creditLimitProp : fetchedLimit;
  const resolvedAvailable =
    availableCreditProp !== undefined ? availableCreditProp : fetchedAvailable;

  const numAmountPreview = Number(amount);
  const purchasePreview =
    Number.isFinite(numAmountPreview) && numAmountPreview > 0
      ? numAmountPreview
      : 0;
  const remainingAvailable =
    resolvedAvailable != null ? resolvedAvailable - purchasePreview : null;
  const exceedsCreditLimit =
    !alreadyInCardBalance &&
    resolvedLimit != null &&
    resolvedAvailable != null &&
    purchasePreview > 0 &&
    purchasePreview > resolvedAvailable;

  const handleCancel = () => handleRootOpenChange(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fortnightId || !categoryId) {
      setError('Selecciona quincena y categoría');
      return;
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!description.trim()) {
      setError('La descripción es obligatoria');
      return;
    }
    const instCurTrim = installmentCurrent.trim();
    const instTotTrim = installmentTotal.trim();
    if (instCurTrim || instTotTrim) {
      const cur = Number.parseInt(instCurTrim, 10);
      const tot = Number.parseInt(instTotTrim, 10);
      if (
        !Number.isFinite(cur) ||
        !Number.isFinite(tot) ||
        cur < 1 ||
        tot < 1 ||
        cur > tot
      ) {
        setError(
          'Opcional: indica cuota actual y total (enteros, 1 ≤ actual ≤ total)',
        );
        return;
      }
    }
    if (exceedsCreditLimit) {
      setError(
        'El monto supera el crédito disponible. Reduce el monto o registra un pago primero.',
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const installmentPayload =
        installmentCurrent.trim() && installmentTotal.trim()
          ? {
              credit_installment_current: Number.parseInt(
                installmentCurrent.trim(),
                10,
              ),
              credit_installment_total: Number.parseInt(
                installmentTotal.trim(),
                10,
              ),
            }
          : {};

      await createCreditCardPurchase(
        creditCardId,
        {
          fortnight_id: Number(fortnightId),
          category_id: Number(categoryId),
          description: description.trim(),
          amount: numAmount,
          payment_date: paymentDate,
          already_in_card_balance: alreadyInCardBalance,
          ...installmentPayload,
        },
        context,
      );
      toast.success(
        alreadyInCardBalance
          ? 'Compra registrada en bitácora (deuda sin cambio)'
          : 'Compra registrada',
      );
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al registrar la compra',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const a11yDescription = alreadyInCardBalance
    ? 'El movimiento aparece en el ciclo; la deuda y el disponible no cambian.'
    : 'Registra un gasto pagado con esta tarjeta. Se aplicará al saldo de la tarjeta y a la quincena elegida.';

  const cancelButton = (
    <Button
      type="button"
      variant="ghost"
      className="absolute left-0 h-9 px-2 text-primary"
      onClick={handleCancel}
      disabled={submitting}
    >
      Cancelar
    </Button>
  );

  const dialogHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <DialogTitle className="text-base font-semibold">
        Registrar compra
      </DialogTitle>
      <DialogDescription className="sr-only">{a11yDescription}</DialogDescription>
    </div>
  );

  const sheetHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <SheetTitle className="text-base font-semibold">
        Registrar compra
      </SheetTitle>
      <SheetDescription className="sr-only">{a11yDescription}</SheetDescription>
    </div>
  );

  const formBody = (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn('flex flex-col gap-4', isMobile && 'pb-1')}
    >
      {error ? (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!alreadyInCardBalance &&
        resolvedLimit != null &&
        remainingAvailable != null && (
          <div
            className={cn(
              METRIC_STRIP_CLASS,
              'px-3 py-2.5',
              'border-black/[0.06] bg-black/[0.02] shadow-none',
              'dark:border-white/10 dark:bg-white/[0.04]',
              exceedsCreditLimit && 'ring-1 ring-destructive/25',
            )}
            role="status"
            aria-live="polite"
            aria-label="Crédito disponible"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]',
                    exceedsCreditLimit
                      ? 'bg-destructive/10 dark:bg-destructive/15'
                      : 'bg-black/[0.05] dark:bg-white/[0.08]',
                  )}
                  aria-hidden
                >
                  <WalletCards
                    className={cn(
                      'h-3.5 w-3.5',
                      exceedsCreditLimit
                        ? 'text-destructive'
                        : 'text-foreground/70',
                    )}
                    data-icon="inline-start"
                  />
                </span>
                <p
                  className={cn(
                    'text-[11px] font-medium tracking-[-0.01em]',
                    exceedsCreditLimit
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  Crédito disponible
                </p>
              </div>
              <p
                className={cn(
                  'shrink-0 font-mono text-[15px] font-semibold tabular-nums tracking-tight',
                  exceedsCreditLimit
                    ? 'text-destructive'
                    : 'text-foreground',
                )}
              >
                {formatCurrency(remainingAvailable)}
              </p>
            </div>
            {exceedsCreditLimit ? (
              <p
                className="mt-1.5 text-[11px] leading-snug text-destructive/90"
                role="alert"
              >
                Este monto supera el límite disponible; reduce el monto o
                registra un pago primero.
              </p>
            ) : null}
          </div>
        )}

      {loading ? (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label="Cargando formulario"
        >
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            <GroupedRow label="Fecha" htmlFor="qp-date">
              <Input
                id="qp-date"
                type="date"
                value={paymentDate}
                onChange={(e) => handlePaymentDateChange(e.target.value)}
                aria-label="Fecha de la compra"
                className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </GroupedRow>

            <div className="space-y-1 px-3 py-1.5">
              <div className="flex items-start gap-3">
                <Label className={cn(groupedLabelClass, 'pt-2.5')}>
                  Quincena
                </Label>
                <div className="min-w-0 flex-1 space-y-1">
                  <FortnightMonthStepper
                    year={pickerYear}
                    month={pickerMonth}
                    catalog={fortnights}
                    selectedPeriod={selectedPeriodInPicker}
                    onYearMonthChange={(y, m) => {
                      setPickerYear(y);
                      setPickerMonth(m);
                    }}
                    onPickPeriod={handlePickPeriod}
                  />
                  {fortnightMismatchesDate ? (
                    <p className="text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                      No coincide con la fecha
                      {dateMatchedFortnight
                        ? ` (${dateMatchedFortnight.name})`
                        : ''}
                      .
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <GroupedRow label="Categoría">
              <CategoryGroupedSelect
                categories={categories}
                value={categoryId ? Number(categoryId) : undefined}
                onValueChange={(id) => setCategoryId(String(id))}
                onOpenChange={handleSelectOpenChange}
                includeCategoryId={categoryId ? Number(categoryId) : null}
                triggerClassName={rowTriggerClass}
                placeholder="Selecciona"
                ariaLabel="Categoría del gasto"
              />
            </GroupedRow>

            <GroupedRow label="Descripción" htmlFor="qp-desc">
              <Input
                id="qp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="Descripción de la compra"
                autoCapitalize="sentences"
                autoComplete="off"
                className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </GroupedRow>

            <div className="space-y-1 px-3 py-2">
              <Label
                htmlFor="qp-amount"
                className="text-sm font-medium text-foreground"
              >
                Monto
              </Label>
              <div className="flex items-center gap-2">
                <span
                  className="mr-[2.5rem] inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-xs font-semibold tracking-wide text-muted-foreground"
                  aria-hidden
                >
                  MXN
                </span>
                <CurrencyInput
                  id="qp-amount"
                  hideSymbol
                  clearable
                  value={Number(amount) || 0}
                  onChange={(val) => setAmount(val === 0 ? '' : String(val))}
                  placeholder="0.00"
                  aria-label="Monto de la compra"
                  className="h-10 border-0 bg-transparent px-0 font-mono text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0 md:h-12 md:text-4xl"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cuotas (opcional)
            </p>
            <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
              <GroupedRow label="Actual" htmlFor="qp-installment-cur">
                <Input
                  id="qp-installment-cur"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="ej. 11"
                  value={installmentCurrent}
                  onChange={(e) => setInstallmentCurrent(e.target.value)}
                  aria-label="Número de cuota actual (compra en varios meses)"
                  className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </GroupedRow>
              <GroupedRow label="Total" htmlFor="qp-installment-tot">
                <Input
                  id="qp-installment-tot"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="ej. 15"
                  value={installmentTotal}
                  onChange={(e) => setInstallmentTotal(e.target.value)}
                  aria-label="Total de cuotas del plan"
                  className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </GroupedRow>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Si rellenas ambos, la compra se trata como pago en cuotas y no
              aparece en la planificación por quincena (sí en el estado de cuenta
              de la tarjeta).
            </p>
          </div>

          <div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
              <div className="px-3 py-1.5">
                <ToggleField
                  label="Ya está en el saldo"
                  checked={alreadyInCardBalance}
                  onCheckedChange={setAlreadyInCardBalance}
                  layout="row"
                  className="[&>div]:min-h-11"
                />
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Actívalo si ya ajustaste la deuda al corte. El movimiento queda en
              bitácora sin volver a subir la deuda.
            </p>
          </div>
        </>
      )}

      <Button
        type="submit"
        disabled={submitting || loading || exceedsCreditLimit}
        className="h-11 w-full rounded-xl"
      >
        {submitting ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleRootOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
          onPointerDownOutside={preventDismissWhileSelectOpen}
          onFocusOutside={preventDismissWhileSelectOpen}
          onInteractOutside={preventDismissWhileSelectOpen}
        >
          <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open ? formBody : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleRootOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90dvh,90vh)] w-full max-w-md flex-col gap-0 overflow-hidden p-0"
        onPointerDownOutside={preventDismissWhileSelectOpen}
        onFocusOutside={preventDismissWhileSelectOpen}
        onInteractOutside={preventDismissWhileSelectOpen}
      >
        <div className="border-b border-border/50 px-5 py-3">{dialogHeader}</div>
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-5">
          {open ? formBody : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCardQuickPurchaseDialog;
