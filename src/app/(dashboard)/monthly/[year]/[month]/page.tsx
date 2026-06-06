import { notFound } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { getMonthlyPageData } from '@/features/monthly/server/monthly.service';
import { getOwnerContextFromPageSearchParams } from '@/lib/server/get-owner-context';
import MonthlyHeader from '@/components/MonthlyHeader';
import CreateNextMonthButton from '@/components/CreateNextMonthButton';
import MonthlyFortnightView from '@/components/MonthlyFortnightView';
import { MonthlyPanelLayout } from '@/components/monthly/MonthlyPanelLayout';
import { MonthlyNavNextLink } from '@/components/monthly/MonthlyNavNextLink';
import CreatePlanningMonthButton from '@/components/CreatePlanningMonthButton';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { getSuggestedFortnightPeriodForMonth } from '@/lib/fortnight-calendar';
import { parseMonthlyRouteParams } from '@/lib/planner/monthly-page';

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

  const ownerContext = await getOwnerContextFromPageSearchParams(
    resolvedSearchParams,
  );
  if ('error' in ownerContext) notFound();

  const { year, month } = parsedParams.value;
  const monthName = getMonthName(month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const prevMonthStr = prevMonth.toString().padStart(2, '0');
  const nextMonthStr = nextMonth.toString().padStart(2, '0');

  const ownerQuery =
    ownerContext.ownerType && ownerContext.ownerId
      ? `?ownerType=${ownerContext.ownerType}&ownerId=${ownerContext.ownerId}`
      : '';
  const prevHref = `/monthly/${prevYear}/${prevMonthStr}${ownerQuery}`;
  const nextHref = `/monthly/${nextYear}/${nextMonthStr}${ownerQuery}`;

  const [currentYear, currentMonth] = todayCalendarDate()
    .split('-')
    .map(Number)
    .slice(0, 2) as [number, number];
  const isCurrentMonth = year === currentYear && month === currentMonth;

  let pageData;
  try {
    pageData = await getMonthlyPageData({
      ownerFilter: ownerContext.ownerFilter,
      year,
      month,
      yearParam,
      monthParam,
      prevYear,
      prevMonthStr,
      nextYear,
      nextMonthStr,
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
    plannerLoanDue,
    firstTransactions,
    secondTransactions,
    firstSummary,
    secondSummary,
    budgetPanel,
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

  const ownerKey = `${ownerContext.ownerType}-${ownerContext.ownerId}`;

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
  const [, , currentDay] = todayCalendarDate().split('-').map(Number);
  const isFirstFortnight = currentDay <= 15;
  const suggestedPeriod = getSuggestedFortnightPeriodForMonth(year, month);
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
  const loanDueFirst = plannerLoanDue.first;
  const loanDueSecond = plannerLoanDue.second;

  const monthHeader = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
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
    </>
  );

  return (
    <MonthlyPanelLayout
      ownerKey={ownerKey}
      year={year}
      month={month}
      suggestedPeriod={suggestedPeriod}
      ownerQuery={ownerQuery}
      budgetPanel={budgetPanel}
      firstTransactions={firstTransactions}
      secondTransactions={secondTransactions}
      monthHeader={monthHeader}
    >
      <MonthlyFortnightView
        ownerKey={ownerKey}
        year={year}
        month={month}
        wallets={wallets}
        paidWalletIds={paidWalletIds}
        isCurrentMonth={isCurrentMonth}
        first={{
          label: firstLabel,
          transactions: firstTransactions,
          summary: firstSummary,
          fortnightId: firstFortnightId,
          cardDueItems: cardDueFirst,
          loanDueItems: loanDueFirst,
        }}
        second={{
          label: secondLabel,
          transactions: secondTransactions,
          summary: secondSummary,
          fortnightId: secondFortnightId,
          cardDueItems: cardDueSecond,
          loanDueItems: loanDueSecond,
        }}
      />
    </MonthlyPanelLayout>
  );
}
