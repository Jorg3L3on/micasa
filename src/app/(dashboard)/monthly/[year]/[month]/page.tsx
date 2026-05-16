import { notFound } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { fetchFromApi, type OwnerContext } from '@/lib/api-server';
import { getOwnerContextFromPageSearchParams } from '@/lib/server/get-owner-context';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import {
  getDuePaymentsForCurrentFortnight,
  getDuePaymentsForPlannerMonth,
} from '@/lib/finance/credit-card-statement.service';
import MonthlyHeader from '@/components/MonthlyHeader';
import CreateNextMonthButton from '@/components/CreateNextMonthButton';
import MonthlyFortnightView from '@/components/MonthlyFortnightView';
import { MonthlyNavNextLink } from '@/components/monthly/MonthlyNavNextLink';
import CreatePlanningMonthButton from '@/components/CreatePlanningMonthButton';
import { parseMonthlyRouteParams } from '@/lib/planner/monthly-page';
import type {
  WalletListItem,
  DuePaymentItem,
  PlannerDuePaymentsResponse,
  PlannerCardChargesSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerCardStatementDueSummary,
  ReportsSummaryFundingFields,
} from '@/types/catalog';

type Transaction = {
  id: number;
  date: string;
  description: string;
  amount: number | string;
  category: string;
  paymentMethod: string;
  is_paid: boolean;
};

type Summary = {
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
  balance: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  planningExpenseCount?: number;
  planningPaidExpenseCount?: number;
  planningUnpaidExpenseCount?: number;
  cardCharges?: PlannerCardChargesSummary | null;
  planningOrphanCardPayments?: PlannerOrphanCardPaymentsSummary | null;
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
} & ReportsSummaryFundingFields;

type FortnightInfo = {
  label: string;
  id: number;
  period: 'FIRST' | 'SECOND';
};

type OwnerSearchParams = Record<string, string | string[] | undefined>;

type MonthlyPageDataInput = {
  yearParam: string;
  monthParam: string;
  year: number;
  month: number;
  prevYear: number;
  prevMonthStr: string;
  nextYear: number;
  nextMonthStr: string;
  ownerContext?: OwnerContext;
  ownerSearchParams: OwnerSearchParams;
  isCurrentMonth: boolean;
};

type MonthlyPageData = {
  firstFortnightInfo: FortnightInfo | null;
  secondFortnightInfo: FortnightInfo | null;
  prevFirstInfo: FortnightInfo | null;
  prevSecondInfo: FortnightInfo | null;
  nextFirstInfo: FortnightInfo | null;
  nextSecondInfo: FortnightInfo | null;
  wallets: WalletListItem[];
  duePayments: DuePaymentItem[];
  plannerDue: PlannerDuePaymentsResponse;
  firstTransactions: Transaction[];
  secondTransactions: Transaction[];
  firstSummary: Summary | null;
  secondSummary: Summary | null;
};

function getMonthName(month: number): string {
  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return months[month - 1] || '';
}

function normalizeOwnerContext(
  searchParams: { ownerType?: string; ownerId?: string },
): OwnerContext | undefined {
  if (!searchParams.ownerType || !searchParams.ownerId) return undefined;
  if (searchParams.ownerType !== 'user' && searchParams.ownerType !== 'house') {
    return undefined;
  }
  const ownerId = Number(searchParams.ownerId);
  if (!Number.isInteger(ownerId) || ownerId <= 0) return undefined;
  return {
    ownerType: searchParams.ownerType,
    ownerId,
  };
}

async function getFortnightInfo(
  year: string,
  month: string,
  period: 'FIRST' | 'SECOND',
  ownerContext?: OwnerContext,
): Promise<FortnightInfo | null> {
  const response = await fetchFromApi<{
    id: number;
    label: string;
    year: number;
    month: number;
    period: string;
  } | null>(
    `/api/fortnights?year=${year}&month=${month}&period=${period}`,
    ownerContext,
  );

  if (response === null) return null;

  return {
    label: response.label,
    id: response.id,
    period,
  };
}

async function getTransactions(
  year: string,
  month: string,
  period: 'FIRST' | 'SECOND',
  ownerContext?: OwnerContext,
): Promise<Transaction[]> {
  return fetchFromApi<Transaction[]>(
    `/api/transactions?year=${year}&month=${month}&period=${period}&type=expense&exclude_credit_installment=true`,
    ownerContext,
  );
}

async function getSummary(
  year: string,
  month: string,
  period: 'FIRST' | 'SECOND',
  ownerContext?: OwnerContext,
): Promise<Summary> {
  return fetchFromApi<Summary>(
    `/api/reports?type=summary&year=${year}&month=${month}&period=${period}&exclude_credit_installment=true`,
    ownerContext,
  );
}

async function loadActiveWalletsForMonthlyPage(
  searchParams: OwnerSearchParams,
): Promise<WalletListItem[]> {
  const ctx = await getOwnerContextFromPageSearchParams(searchParams);
  if ('error' in ctx) throw new Error('No se pudo resolver el propietario');
  const wallets = await listWalletsByOwner(ctx.ownerFilter);
  return wallets.filter((w) => w.active);
}

async function loadDuePaymentsForCurrentFortnightPage(
  searchParams: OwnerSearchParams,
): Promise<DuePaymentItem[]> {
  const ctx = await getOwnerContextFromPageSearchParams(searchParams);
  if ('error' in ctx) throw new Error('No se pudo resolver el propietario');
  return getDuePaymentsForCurrentFortnight(ctx.ownerFilter);
}

async function loadPlannerDuePaymentsForMonthPage(
  year: number,
  month: number,
  searchParams: OwnerSearchParams,
): Promise<PlannerDuePaymentsResponse> {
  const ctx = await getOwnerContextFromPageSearchParams(searchParams);
  if ('error' in ctx) throw new Error('No se pudo resolver el propietario');
  return getDuePaymentsForPlannerMonth(ctx.ownerFilter, year, month);
}

async function loadMonthlyPageData({
  yearParam,
  monthParam,
  year,
  month,
  prevYear,
  prevMonthStr,
  nextYear,
  nextMonthStr,
  ownerContext,
  ownerSearchParams,
  isCurrentMonth,
}: MonthlyPageDataInput): Promise<MonthlyPageData> {
  const [
    firstFortnightInfo,
    secondFortnightInfo,
    prevFirstInfo,
    prevSecondInfo,
    nextFirstInfo,
    nextSecondInfo,
    wallets,
    duePayments,
    plannerDue,
  ] = await Promise.all([
    getFortnightInfo(yearParam, monthParam, 'FIRST', ownerContext),
    getFortnightInfo(yearParam, monthParam, 'SECOND', ownerContext),
    getFortnightInfo(String(prevYear), prevMonthStr, 'FIRST', ownerContext),
    getFortnightInfo(String(prevYear), prevMonthStr, 'SECOND', ownerContext),
    getFortnightInfo(String(nextYear), nextMonthStr, 'FIRST', ownerContext),
    getFortnightInfo(String(nextYear), nextMonthStr, 'SECOND', ownerContext),
    loadActiveWalletsForMonthlyPage(ownerSearchParams),
    isCurrentMonth
      ? loadDuePaymentsForCurrentFortnightPage(ownerSearchParams)
      : Promise.resolve([] as DuePaymentItem[]),
    loadPlannerDuePaymentsForMonthPage(year, month, ownerSearchParams),
  ]);

  if (firstFortnightInfo === null || secondFortnightInfo === null) {
    return {
      firstFortnightInfo,
      secondFortnightInfo,
      prevFirstInfo,
      prevSecondInfo,
      nextFirstInfo,
      nextSecondInfo,
      wallets,
      duePayments,
      plannerDue,
      firstTransactions: [],
      secondTransactions: [],
      firstSummary: null,
      secondSummary: null,
    };
  }

  const [firstTransactions, secondTransactions, firstSummary, secondSummary] =
    await Promise.all([
      getTransactions(yearParam, monthParam, 'FIRST', ownerContext),
      getTransactions(yearParam, monthParam, 'SECOND', ownerContext),
      getSummary(yearParam, monthParam, 'FIRST', ownerContext),
      getSummary(yearParam, monthParam, 'SECOND', ownerContext),
    ]);

  return {
    firstFortnightInfo,
    secondFortnightInfo,
    prevFirstInfo,
    prevSecondInfo,
    nextFirstInfo,
    nextSecondInfo,
    wallets,
    duePayments,
    plannerDue,
    firstTransactions,
    secondTransactions,
    firstSummary,
    secondSummary,
  };
}

export default async function MonthlyPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ ownerType?: string; ownerId?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await params;
  const resolvedSearchParams = await searchParams;
  const parsedParams = parseMonthlyRouteParams(yearParam, monthParam);
  if (!parsedParams.ok) notFound();

  const ownerContext = normalizeOwnerContext(resolvedSearchParams);
  const { year, month } = parsedParams.value;
  const monthName = getMonthName(month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const prevMonthStr = prevMonth.toString().padStart(2, '0');
  const nextMonthStr = nextMonth.toString().padStart(2, '0');

  const ownerSearchParams: OwnerSearchParams = {
    ownerType: resolvedSearchParams.ownerType,
    ownerId: resolvedSearchParams.ownerId,
  };

  const ownerQuery =
    ownerContext &&
    typeof ownerContext.ownerId === 'number' &&
    ownerContext.ownerType
      ? `?ownerType=${ownerContext.ownerType}&ownerId=${ownerContext.ownerId}`
      : '';
  const prevHref = `/monthly/${prevYear}/${prevMonthStr}${ownerQuery}`;
  const nextHref = `/monthly/${nextYear}/${nextMonthStr}${ownerQuery}`;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentMonth = year === currentYear && month === currentMonth;

  let pageData: MonthlyPageData;
  try {
    pageData = await loadMonthlyPageData({
      yearParam,
      monthParam,
      year,
      month,
      prevYear,
      prevMonthStr,
      nextYear,
      nextMonthStr,
      ownerContext,
      ownerSearchParams,
      isCurrentMonth,
    });
  } catch (error) {
    console.error('Error loading monthly financial panel:', error);
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-destructive/30 bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold leading-tight">
                No se pudo cargar el panel financiero
              </h2>
              <p className="text-sm text-muted-foreground">
                La información financiera no se muestra con valores de respaldo para evitar lecturas incorrectas. Recarga la página o intenta de nuevo más tarde.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    firstFortnightInfo,
    secondFortnightInfo,
    prevFirstInfo,
    prevSecondInfo,
    nextFirstInfo,
    nextSecondInfo,
    wallets,
    duePayments,
    plannerDue,
    firstTransactions,
    secondTransactions,
    firstSummary,
    secondSummary,
  } = pageData;

  const hasPrevMonth = prevFirstInfo !== null || prevSecondInfo !== null;
  const hasNextMonth = nextFirstInfo !== null || nextSecondInfo !== null;

  const prevMonthLabel = `${getMonthName(prevMonth)} ${prevYear}`;
  const nextMonthLabel = `${getMonthName(nextMonth)} ${nextYear}`;

  const nextMonthAlreadyCreated = nextFirstInfo !== null && nextSecondInfo !== null;
  const canCreateNextMonth =
    !hasNextMonth &&
    nextYear === currentYear &&
    nextMonth >= currentMonth &&
    !nextMonthAlreadyCreated;

  const firstLabel = firstFortnightInfo?.label || `1-15 ${monthName} ${year}`;
  const secondLabel =
    secondFortnightInfo?.label ||
    `16-${new Date(year, month, 0).getDate()} ${monthName} ${year}`;
  const firstFortnightId = firstFortnightInfo?.id || 0;
  const secondFortnightId = secondFortnightInfo?.id || 0;
  const monthIsMissing = firstFortnightInfo === null || secondFortnightInfo === null;

  const ownerKey = ownerContext
    ? `${ownerContext.ownerType}-${ownerContext.ownerId}`
    : 'user-default';

  if (monthIsMissing) {
    return (
      <div className="space-y-5">
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm"
          role="group"
          aria-label="Selector de mes"
        >
          <MonthlyHeader
            year={year}
            month={month}
            monthName={monthName}
            hasPrevMonth={hasPrevMonth}
            prevHref={prevHref}
            prevMonthLabel={prevMonthLabel}
          />
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-lg font-semibold leading-tight">
              {monthName} {year}
            </h1>
            <p className="text-xs text-muted-foreground">Panel financiero mensual</p>
          </div>
          {hasNextMonth ? (
            <MonthlyNavNextLink href={nextHref} label={nextMonthLabel} />
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold leading-tight">
                Falta crear la planificación de {monthName} {year}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Este mes no tiene las dos quincenas necesarias. Crea el mes antes de capturar gastos, ingresos o pagos de tarjeta para evitar datos incompletos.
              </p>
            </div>
            <CreatePlanningMonthButton
              year={year}
              month={month}
              monthLabel={`${monthName} ${year}`}
              canCreate
              variant="hero"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-lg border border-border/60 px-2 py-1">
              1a quincena: {firstFortnightInfo ? 'creada' : 'pendiente'}
            </span>
            <span className="rounded-lg border border-border/60 px-2 py-1">
              2a quincena: {secondFortnightInfo ? 'creada' : 'pendiente'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (firstSummary === null || secondSummary === null) {
    throw new Error('Resumen mensual incompleto');
  }

  const dueWalletIds = duePayments.map((dp) => dp.walletId);
  const currentDay = now.getDate();
  const isFirstFortnight = currentDay <= 15;
  const suggestedPeriod: 'FIRST' | 'SECOND' =
    isCurrentMonth && currentDay <= 15
      ? 'FIRST'
      : isCurrentMonth
        ? 'SECOND'
        : 'FIRST';
  const paidWalletIds = isCurrentMonth
    ? wallets
        .filter((w) => {
          if (w.type !== 'CREDIT_CARD' && w.type !== 'DEPARTMENT_STORE_CARD') {
            return false;
          }
          if (w.due_day == null) return false;
          const dueInFortnight = isFirstFortnight
            ? w.due_day >= 1 && w.due_day <= 15
            : w.due_day >= 16;
          return dueInFortnight && !dueWalletIds.includes(w.id);
        })
        .map((w) => w.id)
    : [];

  const cardDueFirst = plannerDue.first;
  const cardDueSecond = plannerDue.second;

  return (
    <>
      <div
        className="mb-5 flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm sm:mb-5 sm:gap-3 sm:px-4"
        role="group"
        aria-label="Selector de mes"
      >
        <div className="shrink-0">
          <MonthlyHeader
            year={year}
            month={month}
            monthName={monthName}
            hasPrevMonth={hasPrevMonth}
            prevHref={prevHref}
            prevMonthLabel={prevMonthLabel}
          />
        </div>

        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <h1 className="truncate text-lg font-semibold leading-tight">
            {monthName} {year}
          </h1>
          <div className="mt-0.5 flex items-center justify-center gap-1.5">
            <p className="text-xs text-muted-foreground">
              Panel financiero mensual
            </p>
            {isCurrentMonth ? (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300">
                <span className="h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
                Actual
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          {hasNextMonth ? (
            <MonthlyNavNextLink href={nextHref} label={nextMonthLabel} />
          ) : (
            <CreateNextMonthButton
              nextYear={nextYear}
              nextMonth={nextMonth}
              nextMonthLabel={nextMonthLabel}
              canCreate={canCreateNextMonth}
            />
          )}
        </div>
      </div>

      <MonthlyFortnightView
        ownerKey={ownerKey}
        year={year}
        month={month}
        suggestedPeriod={suggestedPeriod}
        wallets={wallets}
        paidWalletIds={paidWalletIds}
        isCurrentMonth={isCurrentMonth}
        first={{
          label: firstLabel,
          transactions: firstTransactions,
          summary: firstSummary,
          fortnightId: firstFortnightId,
          cardDueItems: cardDueFirst,
        }}
        second={{
          label: secondLabel,
          transactions: secondTransactions,
          summary: secondSummary,
          fortnightId: secondFortnightId,
          cardDueItems: cardDueSecond,
        }}
      />
    </>
  );
}
