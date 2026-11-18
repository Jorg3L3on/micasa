/**
 * Numbers and copy for the Resumen step (MIC-I18-5). Pure: the free amounts
 * come from `computeOnboardingPreview` (phase 3) and the dates from
 * `generateOnboardingFortnights`, the same list onboarding creates.
 */
import type {
  ExpenseTemplateDraft,
  IncomeTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';
import {
  committedBarPercent,
  computeOnboardingPreview,
  type QuincenaPreview,
} from '@/components/onboarding/onboarding-preview';
import { frequencyFromFlags } from '@/components/onboarding/fortnight-frequency';
import { monthlyIncomeEquivalent } from '@/components/onboarding/steps/onboarding-rows';
import { formatCalendarDate, formatDisplayDayMonth } from '@/lib/calendar-dates';
import {
  generateOnboardingFortnights,
  type OnboardingFortnight,
} from '@/lib/finance/onboarding-fortnights';

export type SummaryDrafts = {
  wallets: readonly WalletDraft[];
  incomeTemplates: readonly IncomeTemplateDraft[];
  expenseTemplates: readonly ExpenseTemplateDraft[];
};

export type QuincenaTile = {
  key: string;
  period: OnboardingFortnight['period'];
  /** Eyebrow, e.g. "2ª quincena · 15 – 29 nov". */
  title: string;
  /** Screen-reader name, e.g. "Segunda quincena de noviembre". */
  ariaLabel: string;
  preview: QuincenaPreview;
  barPercent: number;
};

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const monthName = (month: number): string => MONTH_NAMES[month - 1] ?? '';

/** "15 – 29 nov" inside one month, "30 nov – 14 dic" across two. */
export const formatQuincenaRange = (start: Date, end: Date): string => {
  const startYmd = formatCalendarDate(start);
  const endYmd = formatCalendarDate(end);
  const sameMonth = startYmd.slice(0, 7) === endYmd.slice(0, 7);
  const startLabel = sameMonth
    ? String(Number(startYmd.slice(8, 10)))
    : formatDisplayDayMonth(startYmd);
  return `${startLabel} – ${formatDisplayDayMonth(endYmd)}`;
};

/**
 * The quincenas still ahead on `todayYmd` (the one in progress first), from
 * the fortnights onboarding creates.
 */
export const upcomingFortnights = (
  startDate: string,
  todayYmd: string,
  count = 2,
): OnboardingFortnight[] =>
  generateOnboardingFortnights(startDate)
    .filter((fortnight) => formatCalendarDate(fortnight.endDate) >= todayYmd)
    .slice(0, count);

/** The two tiles that lead Resumen: free amount, bar and dates per quincena. */
export const summaryQuincenaTiles = (
  drafts: SummaryDrafts,
  startDate: string,
  todayYmd: string,
): QuincenaTile[] => {
  const preview = computeOnboardingPreview(drafts);
  return upcomingFortnights(startDate, todayYmd).map((fortnight) => {
    const first = fortnight.period === 'FIRST';
    const quincena = first ? preview.first : preview.second;
    return {
      key: `${fortnight.year}-${fortnight.month}-${fortnight.period}`,
      period: fortnight.period,
      title: `${first ? '1ª' : '2ª'} quincena · ${formatQuincenaRange(fortnight.startDate, fortnight.endDate)}`,
      ariaLabel: `${first ? 'Primera' : 'Segunda'} quincena de ${monthName(fortnight.month)}`,
      preview: quincena,
      barPercent: committedBarPercent(quincena),
    };
  });
};

/** "Hoy empiezas en la 2ª de noviembre." for the quincena diagram; null when out of range. */
export const todayQuincenaCaption = (startDate: string, todayYmd: string): string | null => {
  const current = upcomingFortnights(startDate, todayYmd, 1)[0];
  if (!current || formatCalendarDate(current.startDate) > todayYmd) return null;
  return `Hoy empiezas en la ${current.period === 'FIRST' ? '1ª' : '2ª'} de ${monthName(current.month)}.`;
};

/** First word of the account name, for "Esto te queda libre, Mariana". */
export const firstName = (fullName: string | null | undefined): string =>
  (fullName ?? '').trim().split(/\s+/)[0] ?? '';

export const summaryTitle = (fullName: string | null | undefined): string => {
  const name = firstName(fullName);
  return name ? `Esto te queda libre, ${name}` : 'Esto te queda libre';
};

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** Up to three names, then "y N más". */
export const shortList = (names: readonly string[], max = 3): string => {
  const clean = names.map((name) => name.trim()).filter((name) => name !== '');
  if (clean.length <= max) return clean.join(', ');
  return `${clean.slice(0, max).join(', ')} y ${clean.length - max} más`;
};

const FREQUENCY_PHRASE = {
  BOTH: 'cada quincena',
  FIRST: 'la 1ª quincena',
  SECOND: 'la 2ª quincena',
} as const;

export type SummaryGroupKey = 'wallets' | 'incomes' | 'expenses';

export type SummaryGroup = {
  key: SummaryGroupKey;
  title: string;
  subtitle: string;
  /** `null` hides the amount (no fixed costs yet). */
  total: number | null;
  /** Printed after the amount, e.g. "al mes". */
  totalSuffix: string | null;
};

const monthlyTotal = (
  items: readonly {
    amount: number;
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
  }[],
): number =>
  Math.round(
    items.reduce(
      (total, item) => total + monthlyIncomeEquivalent(item.amount, frequencyFromFlags(item)),
      0,
    ) * 100,
  ) / 100;

/** One row per group on Resumen: count, short list and total. */
export const summaryGroups = (drafts: SummaryDrafts): SummaryGroup[] => {
  const { wallets, incomeTemplates, expenseTemplates } = drafts;
  const preview = computeOnboardingPreview(drafts);

  const onlyIncome = incomeTemplates.length === 1 ? incomeTemplates[0] : null;
  const incomeSubtitle = onlyIncome
    ? `${onlyIncome.name.trim() || 'Ingreso'}, ${FREQUENCY_PHRASE[frequencyFromFlags(onlyIncome)]}`
    : shortList(incomeTemplates.map((income) => income.name));

  return [
    {
      key: 'wallets',
      title: plural(wallets.length, 'billetera', 'billeteras'),
      subtitle: shortList(wallets.map((wallet) => wallet.name)),
      total: preview.balanceToday,
      totalSuffix: null,
    },
    {
      key: 'incomes',
      title: plural(incomeTemplates.length, 'ingreso', 'ingresos'),
      subtitle: incomeSubtitle,
      total: monthlyTotal(incomeTemplates),
      totalSuffix: 'al mes',
    },
    expenseTemplates.length === 0
      ? {
          key: 'expenses',
          title: 'Sin gastos fijos',
          subtitle: 'Los agregas desde tu panel cuando quieras.',
          total: null,
          totalSuffix: null,
        }
      : {
          key: 'expenses',
          title: plural(expenseTemplates.length, 'gasto fijo', 'gastos fijos'),
          subtitle: shortList(expenseTemplates.map((expense) => expense.name)),
          total: monthlyTotal(expenseTemplates),
          totalSuffix: 'al mes',
        },
  ];
};
