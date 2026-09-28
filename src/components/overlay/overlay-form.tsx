'use client';

import { type ReactNode } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleX,
} from 'lucide-react';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  addCalendarDays,
  formatStepperDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';

export const OVERLAY_ROW_TRIGGER_CLASS =
  'h-11 w-full max-w-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent';

export const OVERLAY_ROW_INPUT_CLASS =
  'h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent';

export const OVERLAY_ROW_NUMBER_INPUT_CLASS = `${OVERLAY_ROW_INPUT_CLASS} font-sans tabular-nums`;

export const OVERLAY_ROW_TEXTAREA_CLASS =
  'min-h-11 resize-none border-0 bg-transparent px-0 py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent';

export const OVERLAY_GROUPED_LABEL_CLASS =
  'w-[5rem] shrink-0 text-sm font-medium leading-none text-foreground';

export const OVERLAY_GROUPED_CARD_CLASS =
  'divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card';

export const OVERLAY_PRIMARY_BUTTON_CLASS = 'h-11 w-full rounded-xl';

/** Ghost action under the primary (e.g. "Quitar plan"). */
export const OVERLAY_SECONDARY_BUTTON_CLASS = 'h-9 w-full rounded-xl';

export const OVERLAY_AMOUNT_INPUT_CLASS =
  'h-10 border-0 bg-transparent px-0 font-sans text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0 md:h-12 md:text-4xl';

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
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1 px-3 py-1.5">
    <div className="flex min-h-11 items-center gap-3">
      {htmlFor ? (
        <Label htmlFor={htmlFor} className={OVERLAY_GROUPED_LABEL_CLASS}>
          {label}
        </Label>
      ) : (
        <span className={OVERLAY_GROUPED_LABEL_CLASS}>{label}</span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  </div>
);

/** The only error style inside an overlay body. */
export const OverlayErrorBanner = ({ children }: { children: ReactNode }) => (
  <ErrorBanner>{children}</ErrorBanner>
);

/** Helper or context copy above/below a grouped card. */
export const OverlayHint = ({
  children,
  role,
  className,
}: {
  children: ReactNode;
  role?: 'status';
  className?: string;
}) => (
  <p
    role={role}
    className={cn('px-1 text-xs leading-snug text-muted-foreground', className)}
  >
    {children}
  </p>
);

/** Small label above a second grouped card (e.g. "Datos de crédito"). */
export const OverlaySectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="px-1 text-xs font-medium text-muted-foreground">{children}</p>
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

const HIDDEN_DATE_INPUT_CLASS =
  'absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer';

type DateStepperFrameProps = {
  value: string | null;
  label: string;
  placeholder: string;
  disabled?: boolean;
  onStep: (days: number) => void;
  onPick: (next: string) => void;
  trailing?: ReactNode;
};

const DateStepperFrame = ({
  value,
  label,
  placeholder,
  disabled,
  onStep,
  onPick,
  trailing,
}: DateStepperFrameProps) => {
  const display = value ? formatStepperDate(value) : placeholder;
  return (
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
        disabled={disabled}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="relative min-h-11 min-w-0 flex-1 rounded-md focus-within:ring-2 focus-within:ring-ring/50">
        <span
          className={cn(
            'pointer-events-none flex h-11 items-center justify-center truncate text-sm font-medium',
            value ? 'capitalize text-primary-text' : 'text-muted-foreground',
          )}
          aria-hidden
        >
          {display}
        </span>
        <input
          type="date"
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value) onPick(event.target.value);
          }}
          aria-label={`${label}, ${display}`}
          className={HIDDEN_DATE_INPUT_CLASS}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        aria-label="Día siguiente"
        disabled={disabled}
        onClick={() => onStep(1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {trailing}
    </div>
  );
};

/** Required calendar day (`YYYY-MM-DD`). The only date control allowed in overlays. */
export const DateStepper = ({
  value,
  onChange,
  label = 'Fecha',
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  disabled?: boolean;
}) => (
  <DateStepperFrame
    value={value}
    label={label}
    placeholder={value}
    disabled={disabled}
    onStep={(days) => onChange(addCalendarDays(value, days))}
    onPick={onChange}
  />
);

/** Nullable calendar day; empty shows `placeholder` and stepping starts from today. */
export const OptionalDateStepper = ({
  value,
  onChange,
  label = 'Fecha',
  placeholder = 'Sin fecha',
  disabled,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) => (
  <DateStepperFrame
    value={value}
    label={label}
    placeholder={placeholder}
    disabled={disabled}
    onStep={(days) => onChange(addCalendarDays(value ?? todayCalendarDate(), days))}
    onPick={onChange}
    trailing={
      value && !disabled ? (
        <FieldClearButton
          label={`Quitar ${label.toLowerCase()}`}
          onClear={() => onChange(null)}
        />
      ) : null
    }
  />
);
