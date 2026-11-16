import { z } from 'zod';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import {
  dayOptions,
  DUE_DAY_RANGE,
  isValidDueDay,
  nearestValidDueDay,
  type ScheduledKind,
  type ScheduledPeriod,
} from '@/lib/ui/scheduled-items';
import { maxAmountSchema } from '@/schemas/common.schema';
import { INCOME_NO_FORTNIGHT_MESSAGE } from '@/schemas/income-template.schema';
import type { ScheduledRowModel } from './scheduled-rows';

/**
 * Create and edit form of a gasto or ingreso programado (MIC-I16-4): values,
 * the legacy due-day adjustment and the API payloads. The overlay only renders.
 *
 * An expense picks, per quincena, "No aplica", "Sin día fijo" or a valid day
 * (1ª 1-14, 2ª 15-30). "No aplica" on both means it does not repeat and it
 * lands under Sin programar. `isRecurring` and `applies*` are derived from the
 * two selects. An income repeats in at least one quincena.
 */

export const NOT_APPLICABLE = 'none';
export const NO_FIXED_DAY = 'free';
export const NOT_APPLICABLE_LABEL = 'No aplica';

/** `none`, `free` or the day as a string ("5"). */
export type DaySelectValue = string;

export type DaySelectOption = { value: DaySelectValue; label: string };

export const daySelectOptions = (period: ScheduledPeriod): DaySelectOption[] => [
  { value: NOT_APPLICABLE, label: NOT_APPLICABLE_LABEL },
  ...dayOptions(period).map((option) => ({
    value: option.value === null ? NO_FIXED_DAY : String(option.value),
    label: option.label,
  })),
];

export const FORM_TITLE: Record<ScheduledKind, { create: string; edit: string }> = {
  expense: { create: 'Agregar gasto programado', edit: 'Editar gasto programado' },
  income: { create: 'Agregar ingreso programado', edit: 'Editar ingreso programado' },
};

export const formTitle = (kind: ScheduledKind, editing: boolean): string =>
  FORM_TITLE[kind][editing ? 'edit' : 'create'];

/** The primary button: the create title, or "Guardar cambios" on edit. */
export const submitLabel = (kind: ScheduledKind, editing: boolean): string =>
  editing ? 'Guardar cambios' : FORM_TITLE[kind].create;

export const AMOUNT_HINT = 'Déjalo vacío si el monto cambia cada vez.';
export const SCHEDULE_HINT =
  'La 1ª quincena va del último día del mes anterior al 14; la 2ª, del 15 al penúltimo. Si ninguna aplica, queda en Sin programar.';

/** Income lands in cash or debit only (`assertIncomeFundingWallet`). */
export const isIncomeWalletType = (type: string | null | undefined): boolean =>
  type === 'CASH' || type === 'DEBIT_CARD';

/** "Corte de Tarjeta del hogar: día 12." for a card with a cutoff; null otherwise. */
export const cardCutoffHint = (
  wallet: { name: string; type?: string | null; cutoff_day?: number | null } | null | undefined,
): string | null => {
  if (!wallet || !isCreditOrStoreCardWalletType(wallet.type)) return null;
  if (wallet.cutoff_day == null) return `${wallet.name} no tiene día de corte; agrégalo en Billeteras.`;
  return `Corte de ${wallet.name}: día ${wallet.cutoff_day}.`;
};

// ---------------------------------------------------------------------------
// Form values
// ---------------------------------------------------------------------------

const nameSchema = z.string().trim().min(1, 'Escribe un nombre').max(255);
const categorySchema = z.number().int().positive('Elige una categoría');
/** Null = variable; the amount row turns an empty field into null. */
const amountSchema = maxAmountSchema.nullable();
const walletSchema = z.number().int().positive().nullable();

export const expenseFormSchema = z.object({
  name: nameSchema,
  categoryId: categorySchema,
  amount: amountSchema,
  walletId: walletSchema,
  first: z.string(),
  second: z.string(),
  isSubscription: z.boolean(),
  active: z.boolean(),
});

export const incomeFormSchema = z
  .object({
    name: nameSchema,
    categoryId: categorySchema,
    amount: amountSchema,
    walletId: walletSchema,
    source: z.string().max(255),
    first: z.boolean(),
    second: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.first && !values.second) {
      ctx.addIssue({ code: 'custom', path: ['first'], message: INCOME_NO_FORTNIGHT_MESSAGE });
    }
  });

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
export type IncomeFormValues = z.infer<typeof incomeFormSchema>;

const dayToSelect = (day: number | null): DaySelectValue =>
  day === null ? NO_FIXED_DAY : String(day);

const selectToDay = (value: DaySelectValue): number | null => {
  if (value === NOT_APPLICABLE || value === NO_FIXED_DAY) return null;
  const day = Number(value);
  return Number.isInteger(day) ? day : null;
};

export type ExpenseSchedule = {
  first: DaySelectValue;
  second: DaySelectValue;
  /** Set when a stored day was outside its quincena and the form moved it. */
  adjustedHint: string | null;
};

/**
 * Selects for a stored expense. A legacy day outside its quincena (15 in the
 * 1ª, 31 in the 2ª) opens on the nearest valid choice: 15 in the 1ª moves to
 * the 2ª · día 15 when the 2ª does not apply, else to the 1ª · día 14; 31
 * becomes día 30. Nothing is written until the user saves.
 */
export const expenseScheduleFor = (row: ScheduledRowModel): ExpenseSchedule => {
  const { item } = row;
  let first: DaySelectValue = NOT_APPLICABLE;
  let second: DaySelectValue = NOT_APPLICABLE;
  const notes: string[] = [];

  if (item.appliesSecond) {
    const day = item.dueDaySecond;
    if (day !== null && !isValidDueDay('SECOND', day)) {
      const to = nearestValidDueDay('SECOND', day)!;
      notes.push(`La 2ª quincena tenía el día ${day}; lo ajustamos al día ${to}.`);
      second = String(to);
    } else {
      second = dayToSelect(day);
    }
  }

  if (item.appliesFirst) {
    const day = item.dueDayFirst;
    if (day !== null && !isValidDueDay('FIRST', day)) {
      if (day > DUE_DAY_RANGE.FIRST.max && !item.appliesSecond) {
        const to = nearestValidDueDay('SECOND', day)!;
        notes.push(
          `El día ${day} pertenece a la 2ª quincena; lo pasamos a la 2ª · día ${to}.`,
        );
        second = String(to);
      } else {
        const to = nearestValidDueDay('FIRST', day)!;
        notes.push(`La 1ª quincena tenía el día ${day}; lo ajustamos al día ${to}.`);
        first = String(to);
      }
    } else {
      first = dayToSelect(day);
    }
  }

  return {
    first,
    second,
    adjustedHint:
      notes.length > 0 ? `${notes.join(' ')} Se guarda cuando toques Guardar cambios.` : null,
  };
};

export const expenseFormDefaults = (row: ScheduledRowModel | null): ExpenseFormValues => {
  if (!row) {
    return {
      name: '',
      categoryId: 0,
      amount: null,
      walletId: null,
      first: NOT_APPLICABLE,
      second: NOT_APPLICABLE,
      isSubscription: false,
      active: true,
    };
  }
  const schedule = expenseScheduleFor(row);
  return {
    name: row.item.name,
    categoryId: row.categoryId ?? 0,
    amount: row.item.amount,
    walletId: row.walletId,
    first: schedule.first,
    second: schedule.second,
    isSubscription: row.item.isSubscription,
    active: row.item.active,
  };
};

export const incomeFormDefaults = (row: ScheduledRowModel | null): IncomeFormValues => {
  if (!row) {
    return {
      name: '',
      categoryId: 0,
      amount: null,
      walletId: null,
      source: '',
      first: true,
      second: true,
      active: true,
    };
  }
  return {
    name: row.item.name,
    categoryId: row.categoryId ?? 0,
    amount: row.item.amount,
    walletId: row.walletId,
    source: row.source ?? '',
    first: row.item.appliesFirst,
    second: row.item.appliesSecond,
    active: row.item.active,
  };
};

/** True when both selects say "No aplica": the item goes to Sin programar. */
export const expenseRepeats = (values: Pick<ExpenseFormValues, 'first' | 'second'>): boolean =>
  values.first !== NOT_APPLICABLE || values.second !== NOT_APPLICABLE;

const amountOrNull = (amount: number | null): number | null =>
  amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null;

/**
 * PUT/POST body for `/api/expense-templates`. No `cutoffDay`: Corte is read
 * from the card and an update without it keeps the stored value.
 */
export const expensePayload = (values: ExpenseFormValues) => {
  const appliesFirstFortnight = values.first !== NOT_APPLICABLE;
  const appliesSecondFortnight = values.second !== NOT_APPLICABLE;
  return {
    name: values.name.trim(),
    categoryId: values.categoryId,
    suggestedAmount: amountOrNull(values.amount),
    paymentMethodId: values.walletId,
    active: values.active,
    isSubscription: values.isSubscription,
    appliesFirstFortnight,
    appliesSecondFortnight,
    isRecurring: appliesFirstFortnight || appliesSecondFortnight,
    dueDayFirst: appliesFirstFortnight ? selectToDay(values.first) : null,
    dueDaySecond: appliesSecondFortnight ? selectToDay(values.second) : null,
  };
};

/**
 * PUT/POST body for `/api/income-templates`. Sends `walletId` and `userId`
 * (audit B3); `userId` is the item's owner, unchanged.
 */
export const incomePayload = (values: IncomeFormValues, row: ScheduledRowModel | null) => ({
  name: values.name.trim(),
  categoryId: values.categoryId,
  suggestedAmount: amountOrNull(values.amount),
  source: values.source.trim() || null,
  walletId: values.walletId,
  appliesFirstFortnight: values.first,
  appliesSecondFortnight: values.second,
  active: values.active,
  userId: row?.userId ?? null,
});
