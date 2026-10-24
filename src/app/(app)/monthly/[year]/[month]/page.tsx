import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ErrorBanner } from '@/components/error-banner';
import { SectionHeader } from '@/components/section-header';
import { Badge } from '@/components/ui/badge';
import { STATUS_SOFT_CLASS } from '@/lib/status-tone';
import { CalendarPlus } from 'lucide-react';
import { getMonthlyPanelShellData } from '@/features/monthly/server/monthly.service';
import { MonthlyPanelContentSuspense } from '@/features/monthly/server/MonthlyPanelContentSection';
import { fortnightCalendarKey } from '@/features/monthly/server/monthly.queries';
import { getOwnerContextFromPageSearchParams } from '@/lib/server/get-owner-context';
import { withPageActor } from '@/lib/server/with-owner-context';
import MonthlyHeader from '@/components/MonthlyHeader';
import CreateNextMonthButton from '@/components/CreateNextMonthButton';
import { MonthlyPanelLayout } from '@/components/monthly/MonthlyPanelLayout';
import { MonthlyChromeHeader } from '@/components/monthly/MonthlyChromeHeader';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyNavNextLink } from '@/components/monthly/MonthlyNavNextLink';
import CreatePlanningMonthButton from '@/components/CreatePlanningMonthButton';
import { formatMonthHeading, formatMonthTitle, todayCalendarDate } from '@/lib/calendar-dates';
import { PLANNING_MONTH_MAX_YEAR } from '@/lib/finance/planning-month';
import {
  formatFortnightPeriodTitle,
  getCurrentCalendarFortnightRef,
  getCurrentMonthlyPanelHref,
  getSuggestedFortnightPeriodForMonth,
} from '@/lib/fortnight-calendar';
import { parseMonthlyRouteParams } from '@/lib/planner/monthly-page';
import { cn } from '@/lib/utils';
import {
  MONTHLY_CHROME_PADDING_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}): Promise<Metadata> {
  const { year: yearParam, month: monthParam } = await params;
  const parsedParams = parseMonthlyRouteParams(yearParam, monthParam);
  if (!parsedParams.ok) {
    return {
      title: 'Panel financiero',
      description: 'Planea ingresos y gastos por quincena.',
    };
  }
  const { year, month } = parsedParams.value;
  return {
    title: formatMonthHeading(month, year),
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
  const monthName = formatMonthTitle(month);

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
    shell = await withPageActor(ownerContext, '/monthly', () =>
      getMonthlyPanelShellData({
        ownerFilter: ownerContext.ownerFilter,
        year,
        month,
        prevYear,
        prevMonthStr,
        nextYear,
        nextMonthStr,
        isCurrentMonth,
      }),
    );
  } catch (error) {
    console.error('Error loading monthly financial panel:', error);
    return (
      <div className="space-y-5">
        <ErrorBanner>
          <p className="font-medium">No se pudo cargar el panel financiero</p>
          <p className="mt-1">
            La información financiera no se muestra con valores de respaldo para evitar lecturas incorrectas. Recarga la página o intenta de nuevo más tarde.
          </p>
        </ErrorBanner>
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

  const hasPrevMonth = prevFirstInfo !== null || prevSecondInfo !== null;
  const hasNextMonth = nextFirstInfo !== null || nextSecondInfo !== null;

  const prevMonthLabel = formatMonthHeading(prevMonth, prevYear);
  const nextMonthLabel = formatMonthHeading(nextMonth, nextYear);
  const viewedMonthLabel = formatMonthHeading(month, year);

  const nextMonthAlreadyCreated = nextFirstInfo !== null && nextSecondInfo !== null;
  const canCreateNextMonth =
    !hasNextMonth &&
    !nextMonthAlreadyCreated &&
    (nextYear > currentYear ||
      (nextYear === currentYear && nextMonth >= currentMonth)) &&
    nextYear <= PLANNING_MONTH_MAX_YEAR;

  const firstLabel = formatFortnightPeriodTitle('FIRST', month, year);
  const secondLabel = formatFortnightPeriodTitle('SECOND', month, year);
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

        <section
          className={cn(
            MONTHLY_LIQUID_PANEL_CLASS,
            'space-y-3 p-3 sm:space-y-4 sm:p-4',
          )}
          aria-label={`Planeación de ${viewedMonthLabel}`}
        >
          <SectionHeader
            icon={CalendarPlus}
            title={viewedMonthLabel}
            subtitle="Aún no tiene planeación"
            actions={
              <Badge
                variant="outline"
                className="h-5 rounded-full border-border/60 px-2 text-caption font-semibold text-muted-foreground"
              >
                Sin planear
              </Badge>
            }
          />
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
              <CalendarPlus className="h-6 w-6 text-muted-foreground/60" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">
              Falta crear la planeación de {viewedMonthLabel}
            </p>
            <p className="max-w-sm text-body text-muted-foreground">
              Se generan las dos quincenas con tus plantillas de gastos e ingresos. Crea el mes antes de capturar gastos, ingresos o pagos de tarjeta.
            </p>
            <CreatePlanningMonthButton
              year={year}
              month={month}
              monthLabel={viewedMonthLabel}
              canCreate
              variant="plain"
            />
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  'h-5 rounded-full border-transparent px-2 text-caption font-medium',
                  firstFortnightInfo ? STATUS_SOFT_CLASS.success : 'bg-muted/60 text-muted-foreground',
                )}
              >
                1ª quincena · {firstFortnightInfo ? 'creada' : 'pendiente'}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'h-5 rounded-full border-transparent px-2 text-caption font-medium',
                  secondFortnightInfo ? STATUS_SOFT_CLASS.success : 'bg-muted/60 text-muted-foreground',
                )}
              >
                2ª quincena · {secondFortnightInfo ? 'creada' : 'pendiente'}
              </Badge>
            </div>
          </div>
        </section>
      </div>
    );
  }

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
        pageOwner={ownerContext}
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
        monthIsMissing={monthIsMissing}
        todayYmd={todayYmd}
      />
    </MonthlyPanelLayout>
  );
}
