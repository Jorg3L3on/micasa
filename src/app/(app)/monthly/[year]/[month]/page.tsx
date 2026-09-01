import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { getMonthlyPanelShellData } from '@/features/monthly/server/monthly.service';
import { MonthlyPanelContentSuspense } from '@/features/monthly/server/MonthlyPanelContentSection';
import { fortnightCalendarKey } from '@/features/monthly/server/monthly.queries';
import { getOwnerContextFromPageSearchParams } from '@/lib/server/get-owner-context';
import MonthlyHeader from '@/components/MonthlyHeader';
import CreateNextMonthButton from '@/components/CreateNextMonthButton';
import { MonthlyPanelLayout } from '@/components/monthly/MonthlyPanelLayout';
import { MonthlyChromeHeader } from '@/components/monthly/MonthlyChromeHeader';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyNavNextLink } from '@/components/monthly/MonthlyNavNextLink';
import CreatePlanningMonthButton from '@/components/CreatePlanningMonthButton';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  dueDayFallsInFortnight,
  formatFortnightDateRangeLabel,
  getCurrentCalendarFortnightRef,
  getCurrentMonthlyPanelHref,
  getSuggestedFortnightPeriodForMonth,
} from '@/lib/fortnight-calendar';
import { parseMonthlyRouteParams } from '@/lib/planner/monthly-page';
import { cn } from '@/lib/utils';
import {
  MONTHLY_CHROME_PADDING_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';

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

/** Month label; omit year when it matches the calendar current year. */
function formatMonthLabel(
  month: number,
  year: number,
  currentYear: number,
): string {
  const name = getMonthName(month);
  return year === currentYear ? name : `${name} ${year}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}): Promise<Metadata> {
  const { year: yearParam, month: monthParam } = await params;
  const parsedParams = parseMonthlyRouteParams(yearParam, monthParam);
  if (!parsedParams.ok) {
    return {
      title: 'Panel financiero | MiCasa',
      description: 'Planifica ingresos y gastos por quincena.',
    };
  }
  const { year, month } = parsedParams.value;
  const monthName = getMonthName(month);
  return {
    title: `${monthName} ${year} | MiCasa`,
    description: 'Panel financiero: planifica ingresos y gastos por quincena.',
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

  const todayYmd = todayCalendarDate();
  const currentFn = getCurrentCalendarFortnightRef();
  const currentYear = currentFn.year;
  const currentMonth = currentFn.month;
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const currentMonthHref = `${getCurrentMonthlyPanelHref()}${ownerQuery}`;

  let shell;
  try {
    shell = await getMonthlyPanelShellData({
      ownerFilter: ownerContext.ownerFilter,
      year,
      month,
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
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden data-icon="inline-start" />
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

  const pickNav = (index: number) =>
    shell.fortnightMap.get(fortnightCalendarKey(shell.navKeys[index])) ?? null;

  const firstFortnightInfo = pickNav(0);
  const secondFortnightInfo = pickNav(1);
  const prevFirstInfo = pickNav(2);
  const prevSecondInfo = pickNav(3);
  const nextFirstInfo = pickNav(4);
  const nextSecondInfo = pickNav(5);
  const wallets = shell.wallets;
  const duePayments = shell.duePayments;

  const hasPrevMonth = prevFirstInfo !== null || prevSecondInfo !== null;
  const hasNextMonth = nextFirstInfo !== null || nextSecondInfo !== null;

  const prevMonthLabel = formatMonthLabel(prevMonth, prevYear, currentYear);
  const nextMonthLabel = formatMonthLabel(nextMonth, nextYear, currentYear);
  const viewedMonthLabel = formatMonthLabel(month, year, currentYear);

  const nextMonthAlreadyCreated = nextFirstInfo !== null && nextSecondInfo !== null;
  const canCreateNextMonth =
    !hasNextMonth &&
    nextYear === currentYear &&
    nextMonth >= currentMonth &&
    !nextMonthAlreadyCreated;

  const firstLabel = firstFortnightInfo?.label || formatFortnightDateRangeLabel(year, month, 'FIRST');
  const secondLabel =
    secondFortnightInfo?.label || formatFortnightDateRangeLabel(year, month, 'SECOND');
  const firstFortnightId = firstFortnightInfo?.id || 0;
  const secondFortnightId = secondFortnightInfo?.id || 0;
  const monthIsMissing = firstFortnightInfo === null || secondFortnightInfo === null;

  const ownerKey = `${ownerContext.ownerType}-${ownerContext.ownerId}`;
  const suggestedPeriod = getSuggestedFortnightPeriodForMonth(year, month);

  const prevControl = (
    <MonthlyHeader
      year={year}
      month={month}
      monthName={monthName}
      hasPrevMonth={hasPrevMonth}
      prevHref={prevHref}
      prevMonthLabel={prevMonthLabel}
    />
  );

  const nextNavControl = hasNextMonth ? (
    <MonthlyNavNextLink href={nextHref} label={nextMonthLabel} />
  ) : null;

  const createNextControl =
    !hasNextMonth && canCreateNextMonth ? (
      <CreateNextMonthButton
        nextYear={nextYear}
        nextMonth={nextMonth}
        nextMonthLabel={nextMonthLabel}
        canCreate={canCreateNextMonth}
      />
    ) : null;

  if (monthIsMissing) {
    return (
      <div className="space-y-5">
        <MonthlyPanelPreferencesProvider
          ownerKey={ownerKey}
          year={year}
          month={month}
          suggestedPeriod={suggestedPeriod}
        >
          <div
            className={cn(
              '@container',
              MONTHLY_PANEL_SHELL_CLASS,
              MONTHLY_CHROME_PADDING_CLASS,
            )}
          >
            <MonthlyChromeHeader
              year={year}
              month={month}
              monthName={monthName}
              isCurrentMonth={isCurrentMonth}
              currentMonthHref={currentMonthHref}
              todayYmd={todayYmd}
              ownerQuery={ownerQuery}
              firstLabel={firstLabel}
              secondLabel={secondLabel}
              prevControl={prevControl}
              nextNavControl={nextNavControl}
              createNextControl={createNextControl}
              showFortnightToggle={false}
            />
          </div>
        </MonthlyPanelPreferencesProvider>

        <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'p-5')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold leading-tight">
                Falta crear la planificación de {viewedMonthLabel}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Este mes no tiene las dos quincenas necesarias. Crea el mes antes de capturar gastos, ingresos o pagos de tarjeta para evitar datos incompletos.
              </p>
            </div>
            <CreatePlanningMonthButton
              year={year}
              month={month}
              monthLabel={viewedMonthLabel}
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

  const dueWalletIds = duePayments.map((dp) => dp.walletId);
  const paidWalletIds = isCurrentMonth
    ? wallets
        .filter((w) => {
          if (w.type !== 'CREDIT_CARD' && w.type !== 'DEPARTMENT_STORE_CARD') {
            return false;
          }
          if (w.due_day == null) return false;
          const dueInFortnight = dueDayFallsInFortnight(
            w.due_day,
            currentFn.year,
            currentFn.month,
            currentFn.period,
          );
          return dueInFortnight && !dueWalletIds.includes(w.id);
        })
        .map((w) => w.id)
    : [];

  return (
    <MonthlyPanelLayout
      ownerKey={ownerKey}
      year={year}
      month={month}
      monthName={monthName}
      isCurrentMonth={isCurrentMonth}
      currentMonthHref={currentMonthHref}
      todayYmd={todayYmd}
      suggestedPeriod={suggestedPeriod}
      ownerQuery={ownerQuery}
      firstLabel={firstLabel}
      secondLabel={secondLabel}
      prevControl={prevControl}
      nextNavControl={nextNavControl}
      createNextControl={createNextControl}
    >
      <MonthlyPanelContentSuspense
        ownerFilter={ownerContext.ownerFilter}
        ownerKey={ownerKey}
        year={year}
        month={month}
        yearParam={yearParam}
        monthParam={monthParam}
        activePeriod={suggestedPeriod}
        shell={shell}
        ownerQuery={ownerQuery}
        firstLabel={firstLabel}
        secondLabel={secondLabel}
        firstFortnightId={firstFortnightId}
        secondFortnightId={secondFortnightId}
        paidWalletIds={paidWalletIds}
        isCurrentMonth={isCurrentMonth}
        monthIsMissing={monthIsMissing}
      />
    </MonthlyPanelLayout>
  );
}
