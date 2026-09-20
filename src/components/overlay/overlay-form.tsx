'use client';

import { type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { addCalendarDays, APP_TIMEZONE } from '@/lib/calendar-dates';

export const OVERLAY_ROW_TRIGGER_CLASS =
  'h-11 w-full max-w-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent';

export const OVERLAY_GROUPED_LABEL_CLASS =
  'w-[5rem] shrink-0 text-sm font-medium leading-none text-foreground';

export const OVERLAY_GROUPED_CARD_CLASS =
  'divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card';

export const OVERLAY_PRIMARY_BUTTON_CLASS = 'h-11 w-full rounded-xl';

export const OVERLAY_AMOUNT_INPUT_CLASS =
  'h-10 border-0 bg-transparent px-0 font-mono text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0 md:h-12 md:text-4xl';

const dateStepperFormatter = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: APP_TIMEZONE,
});

const formatStepperDate = (ymd: string): string => {
  try {
    const [year, month, day] = ymd.split('-').map(Number);
    return dateStepperFormatter.format(
      new Date(Date.UTC(year, month - 1, day, 12)),
    );
  } catch {
    return ymd;
  }
};

export const FieldClearButton = ({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) => (
  <button
    type="button"
    tabIndex={-1}
    aria-label={label}
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClear}
  >
    <CircleX className="h-4 w-4" aria-hidden />
  </button>
);

const MxnChip = () => (
  <span
    className="mr-[2.5rem] inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-xs font-semibold tracking-wide text-muted-foreground"
    aria-hidden
  >
    MXN
  </span>
);

type AmountRowProps = {
  value: unknown;
  onChange: (val: number) => void;
  label?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  enterKeyHint?: 'next' | 'done';
};

/** Presentational amount row (no react-hook-form). */
export const AmountRow = ({
  value,
  onChange,
  label = 'Monto',
  id,
  ariaLabel,
  disabled,
  enterKeyHint = 'next',
}: AmountRowProps) => (
  <div className="space-y-1 px-3 py-2">
    <span className="text-sm font-medium text-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <MxnChip />
      <CurrencyInput
        id={id}
        hideSymbol
        clearable
        value={value}
        onChange={onChange}
        placeholder="0.00"
        disabled={disabled}
        className={OVERLAY_AMOUNT_INPUT_CLASS}
        enterKeyHint={enterKeyHint}
        aria-label={ariaLabel ?? label}
      />
    </div>
  </div>
);

/** Amount row inside a `<Form>` (FormItem + FormMessage). */
export const FormAmountRow = ({
  value,
  onChange,
  label = 'Monto',
  enterKeyHint = 'next',
}: {
  value: unknown;
  onChange: (val: number) => void;
  label?: string;
  enterKeyHint?: 'next' | 'done';
}) => (
  <FormItem className="space-y-1 px-3 py-2">
    <FormLabel className="text-sm font-medium text-foreground">{label}</FormLabel>
    <div className="flex items-center gap-2">
      <MxnChip />
      <FormControl>
        <CurrencyInput
          hideSymbol
          clearable
          value={value}
          onChange={onChange}
          placeholder="0.00"
          enterKeyHint={enterKeyHint}
          className={OVERLAY_AMOUNT_INPUT_CLASS}
        />
      </FormControl>
    </div>
    <FormMessage />
  </FormItem>
);

/** Label + control row without react-hook-form. */
export const GroupedRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="space-y-1 px-3 py-1.5">
    <div className="flex min-h-11 items-center gap-3">
      <span className={OVERLAY_GROUPED_LABEL_CLASS}>{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  </div>
);

/** Label + control row inside a `<Form>` (FormItem + FormMessage). */
export const FormGroupedRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <FormItem className="space-y-1 px-3 py-1.5">
    <div className="flex min-h-11 items-center gap-3">
      <FormLabel className={OVERLAY_GROUPED_LABEL_CLASS}>{label}</FormLabel>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
    <FormMessage />
  </FormItem>
);

export const DateStepper = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) => (
  <div className="flex items-center gap-2">
    <CalendarDays
      className="h-4 w-4 shrink-0 text-muted-foreground"
      aria-hidden
    />
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      aria-label="Día anterior"
      onClick={() => onChange(addCalendarDays(value, -1))}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <div className="relative min-w-0 flex-1 rounded-md focus-within:ring-2 focus-within:ring-ring/50">
      <span
        className="pointer-events-none block truncate text-center text-sm font-medium capitalize text-primary-text"
        aria-hidden
      >
        {formatStepperDate(value)}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        aria-label={`Fecha, ${formatStepperDate(value)}`}
        className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      aria-label="Día siguiente"
      onClick={() => onChange(addCalendarDays(value, 1))}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);
