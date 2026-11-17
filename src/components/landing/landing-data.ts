/**
 * Example figures and copy for the public landing. The hero story and the
 * sections below it read the same numbers from here, so they cannot drift.
 * Every amount and name is an invented example.
 */

export const PAYCHECK = 18_000;

export type LandingIcon =
  | 'house'
  | 'cart'
  | 'wifi'
  | 'card'
  | 'bolt'
  | 'bank'
  | 'cap'
  | 'coin';

export type LandingExpense = {
  id: string;
  /** Short name used on the hero tags. */
  name: string;
  /** Name shown in the panel rows. */
  panelName: string;
  /** Day of the month (1 to 29 on the hero dial). */
  day: number;
  amount: number;
  icon: LandingIcon;
  iconColor: string;
  /** How the panel says it is paid. */
  via: string;
  /** Radius of the tag anchor on the dial (tuned in the prototype). */
  labelRadius: number;
};

export const EXPENSES: readonly LandingExpense[] = [
  { id: 'renta', name: 'Renta', panelName: 'Renta', day: 1, amount: 7500, icon: 'house', iconColor: '#8f9bff', via: 'Débito', labelRadius: 0.78 },
  { id: 'super', name: 'Súper', panelName: 'Súper', day: 5, amount: 2400, icon: 'cart', iconColor: '#34d399', via: 'Débito', labelRadius: 0.78 },
  { id: 'internet', name: 'Internet', panelName: 'Internet', day: 10, amount: 499, icon: 'wifi', iconColor: '#6ad1ff', via: 'Débito', labelRadius: 1.0 },
  { id: 'tarjeta', name: 'Tarjeta', panelName: 'Pago de tarjeta', day: 12, amount: 3100, icon: 'card', iconColor: '#e08cff', via: 'Tarjeta de crédito', labelRadius: 0.6 },
  { id: 'luz', name: 'Luz', panelName: 'Luz', day: 18, amount: 640, icon: 'bolt', iconColor: '#ffc45c', via: 'Débito', labelRadius: 0.6 },
  { id: 'prestamo', name: 'Préstamo', panelName: 'Préstamo', day: 20, amount: 2850, icon: 'bank', iconColor: '#ff8fb0', via: 'Débito', labelRadius: 0.98 },
  { id: 'cole', name: 'Colegiatura', panelName: 'Colegiatura', day: 25, amount: 3200, icon: 'cap', iconColor: '#9ad0ff', via: 'Débito', labelRadius: 0.98 },
  { id: 'meta', name: 'Ahorro', panelName: 'Ahorro para viaje', day: 28, amount: 1500, icon: 'coin', iconColor: '#34d399', via: 'Meta', labelRadius: 0.6 },
];

export type QuincenaIndex = 0 | 1;

export const QUINCENAS = [
  { name: 'Primera quincena', range: 'último día → 14', tone: '#8f9bff' },
  { name: 'Segunda quincena', range: '15 → penúltimo', tone: '#e08cff' },
] as const;

/** Days 1 to 14 belong to the first quincena, 15 to 29 to the second. */
export const quincenaOfExpenseDay = (day: number): QuincenaIndex => (day < 15 ? 0 : 1);

export const expensesOfQuincena = (index: QuincenaIndex): LandingExpense[] =>
  EXPENSES.filter((expense) => quincenaOfExpenseDay(expense.day) === index);

export const spentInQuincena = (index: QuincenaIndex): number =>
  expensesOfQuincena(index).reduce((sum, expense) => sum + expense.amount, 0);

export const freeInQuincena = (index: QuincenaIndex): number =>
  PAYCHECK - spentInQuincena(index);

export const FREE_FIRST = freeInQuincena(0);
export const FREE_SECOND = freeInQuincena(1);
export const MONTH_INCOME = PAYCHECK * 2;
export const MONTH_SPENT = spentInQuincena(0) + spentInQuincena(1);
export const FREE_MONTH = FREE_FIRST + FREE_SECOND;

/** Whole pesos, as the landing writes them: $7,500. */
export const formatPesos = (amount: number): string =>
  `$${Math.round(amount).toLocaleString('es-MX')}`;

/* -------------------------------------------------------------------------- */
/* Simular compra                                                             */
/* -------------------------------------------------------------------------- */

export const SIMULATOR_MAX = 20_000;
export const SIMULATOR_STEP = 500;
export const SIMULATOR_DEFAULT = 6_000;

export type PurchaseVerdict = 'fits' | 'next-quincena' | 'not-this-month';

export type PurchaseSimulation = {
  verdict: PurchaseVerdict;
  tone: string;
  title: string;
  text: string;
  /** Share of the month's free money the purchase takes, 0 to 100. */
  percent: number;
};

export const simulatePurchase = (amount: number): PurchaseSimulation => {
  const percent = Math.min(100, Math.round((amount / FREE_MONTH) * 100));
  if (amount <= FREE_FIRST) {
    return {
      verdict: 'fits',
      tone: '#34d399',
      title: 'Sí alcanza en esta quincena',
      text: `Después de la compra te quedan ${formatPesos(FREE_FIRST - amount)} libres.`,
      percent,
    };
  }
  if (amount <= FREE_MONTH) {
    return {
      verdict: 'next-quincena',
      tone: '#ffc45c',
      title: 'No cabe en esta quincena',
      text: `Te faltan ${formatPesos(amount - FREE_FIRST)}. Sí cabe si la repartes con la segunda.`,
      percent,
    };
  }
  return {
    verdict: 'not-this-month',
    tone: '#ff7a9f',
    title: 'No alcanza este mes',
    text: `Te faltan ${formatPesos(amount - FREE_MONTH)} aun juntando las dos quincenas.`,
    percent,
  };
};

/* -------------------------------------------------------------------------- */
/* 31-day grid                                                                */
/* -------------------------------------------------------------------------- */

export type DayHalf = 'first' | 'second' | 'next-first';

export type DayAnswer = {
  half: DayHalf;
  tone: string;
  title: string;
  text: string;
};

export const halfOfDay = (day: number): DayHalf => {
  if (day === 31) return 'next-first';
  return day <= 14 ? 'first' : 'second';
};

export const describeDay = (day: number): DayAnswer => {
  const half = halfOfDay(day);
  if (half === 'next-first') {
    return {
      half,
      tone: '#8f9bff',
      title: 'Primera quincena del mes que sigue',
      text: 'Es el último día del mes: ese día cobras, así que ya abre la siguiente.',
    };
  }
  if (half === 'first') {
    return {
      half,
      tone: '#8f9bff',
      title: 'Primera quincena',
      text: `El día ${day} se paga con el cobro del último día del mes anterior.`,
    };
  }
  return {
    half,
    tone: '#e08cff',
    title: 'Segunda quincena',
    text: `El día ${day} se paga con el cobro del 15.`,
  };
};

/* -------------------------------------------------------------------------- */
/* Hero story                                                                 */
/* -------------------------------------------------------------------------- */

export type LandingScene = {
  /** Label on the scene button. */
  label: string;
  words: readonly string[];
  /** Words from this index on carry the blue-to-magenta gradient. */
  highlightFrom: number;
  subline: string;
  /** Seconds the engine takes to move into the next scene. */
  transition: number;
  /** Seconds the scene rests before autoplay moves on. */
  hold: number;
  /** Milliseconds the scene button's progress line takes to fill. */
  progressMs: number;
};

export const SCENES: readonly LandingScene[] = [
  {
    label: 'El caos',
    words: ['El', 'dinero', 'llega.', 'Y', 'se', 'va.'],
    highlightFrom: 3,
    subline:
      'Renta, tarjeta, luz, súper. Todo cae revuelto y a medio mes ya no sabes cuánto queda.',
    transition: 2.6,
    hold: 2.4,
    progressMs: 5200,
  },
  {
    label: 'El mes',
    words: ['Un', 'mes', 'parece', 'una', 'sola', 'cosa.'],
    highlightFrom: 3,
    subline: 'Así lo ven casi todas las apps: treinta días y un solo número.',
    transition: 1.9,
    hold: 1.6,
    progressMs: 4200,
  },
  {
    label: 'El corte',
    words: ['El', 'mes', 'se', 'parte', 'en', 'dos.'],
    highlightFrom: 4,
    subline: 'Cobras el 15 y el último día. Ahí empieza cada quincena, y así planea MiCasa.',
    transition: 3.6,
    hold: 2.0,
    progressMs: 3900,
  },
  {
    label: 'El cobro',
    words: ['Cada', 'cobro', 'llena', 'su', 'mitad.'],
    highlightFrom: 3,
    subline: 'Tu ingreso entra a la quincena que le toca, no a un mes revuelto.',
    transition: 3.4,
    hold: 1.4,
    progressMs: 5000,
  },
  {
    label: 'Los pagos',
    words: ['Cada', 'pago', 'cae', 'en', 'su', 'día.'],
    highlightFrom: 3,
    subline:
      'Los mismos gastos, ahora cada uno en su fecha. Y ves cuánto queda libre antes de gastarlo.',
    transition: 3.0,
    hold: 4.2,
    progressMs: 7600,
  },
  {
    label: 'MiCasa',
    words: ['Tu', 'casa,', 'en', 'orden.'],
    highlightFrom: 2,
    subline: 'MiCasa planea tu dinero como lo cobras: por quincenas. Gratis.',
    transition: 2.8,
    hold: 5.5,
    progressMs: 8500,
  },
];

export const SCENE_COUNT = SCENES.length;

/** Scene shown as a still when motion is reduced or WebGL is missing. */
export const STILL_SCENE = 2;
