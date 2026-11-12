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

/** Wide label column (6rem) for labels like "1ª quincena" that do not fit 5rem. */
export const OVERLAY_GROUPED_LABEL_WIDE_CLASS =
  'w-[6rem] shrink-0 text-sm font-medium leading-none text-foreground';

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

export const OVERLAY_AMOUNT_HERO_CLASS =
  'h-14 border-0 bg-transparent px-16 text-center font-sans text-4xl font-bold tabular-nums text-slate-900 caret-slate-900 shadow-none placeholder:text-slate-500 focus:placeholder:text-transparent focus-visible:ring-0 md:h-16 md:text-5xl';

/**
 * Hero amount for create overlays: a white panel with the MXN prefix and a large
 * centered figure that steps down for long amounts, so a phone never clips it.
 * Inside a `<Form>` (FormItem + FormMessage).
 */
const amountHeroSizeClass = (value: unknown) => {
  const digits = String(Math.trunc(Math.abs(Number(value) || 0))).length;
  if (digits >= 7) return 'text-xl sm:text-2xl md:text-4xl';
  if (digits >= 5) return 'text-3xl md:text-4xl';
  return undefined;
};

export const FormAmountHero = ({
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
  <FormItem className="space-y-1">
    <FormLabel className="sr-only">{label}</FormLabel>
    <div className="relative flex items-center justify-center rounded-2xl border border-primary/30 bg-white px-4 py-4 shadow-sm">
      <span
        className="absolute left-4 top-1/2 -translate-y-1/2 font-sans text-lg font-semibold text-slate-500"
        aria-hidden
      >
        MXN
      </span>
      <FormControl>
        <CurrencyInput
          hideSymbol
          value={value}
          onChange={onChange}
          placeholder="0"
          enterKeyHint={enterKeyHint}
          className={cn(OVERLAY_AMOUNT_HERO_CLASS, amountHeroSizeClass(value))}
        />
      </FormControl>
    </div>
    <FormMessage className="px-1" />
  </FormItem>
);

const MXN_AMOUNT_FORMAT = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Read-only amount row: same layout as `AmountRow`, for totals and summaries. */
export const AmountDisplayRow = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="space-y-1 px-3 py-2">
    <span className="text-sm font-medium text-foreground">{label}</span>
    <div className="flex h-10 items-center gap-2 md:h-12">
      <MxnChip />
      <span className="font-sans text-2xl font-bold tabular-nums text-foreground md:text-4xl">
        {MXN_AMOUNT_FORMAT.format(value)}
      </span>
    </div>
  </div>
);

/** Read-only list row inside a grouped card: icon, title + subtitle, trailing value. */
export const OverlayListRow = ({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) => (
  <div className="flex min-h-11 items-center gap-3 px-3 py-2">
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4"
      aria-hidden
    >
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      {subtitle ? (
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
    {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
  </div>
);

/** Label + control row without react-hook-form. */
export const GroupedRow = ({
  label,
  htmlFor,
  labelWidth = 'default',
  children,
}: {
  label: string;
  htmlFor?: string;
  /** `wide` (6rem) when a label in the card does not fit 5rem. */
  labelWidth?: 'default' | 'wide';
  children: ReactNode;
}) => {
  const labelClass =
    labelWidth === 'wide' ? OVERLAY_GROUPED_LABEL_WIDE_CLASS : OVERLAY_GROUPED_LABEL_CLASS;
  return (
    <div className="space-y-1 px-3 py-1.5">
      <div className="flex min-h-11 items-center gap-3">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className={labelClass}>
            {label}
          </Label>
        ) : (
          <span className={labelClass}>{label}</span>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
};

/** The only error style inside an overlay body. */
export const OverlayErrorBanner = ({ children }: { children: ReactNode }) => (
  <ErrorBanner>{children}</ErrorBanner>
);

/** Amber notice under a card when a value needs attention before saving. */
export const OverlayWarning = ({ children }: { children: ReactNode }) => (
  <p
    role="status"
    className="rounded-lg border border-status-pending/30 bg-status-pending/10 px-3 py-2 text-xs leading-snug text-status-pending"
  >
    {children}
  </p>
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
  icon,
  children,
}: {
  label: string;
  /** Leading line icon (same 16px muted style across the card). */
  icon?: ReactNode;
  children: ReactNode;
}) => (
  <FormItem className="space-y-1 px-3 py-1.5">
    <div className="flex min-h-11 items-center gap-3">
      <FormLabel
        className={cn(
          OVERLAY_GROUPED_LABEL_CLASS,
          icon && 'flex w-[6.75rem] items-center gap-2',
        )}
      >
        {icon ? (
          <span className="shrink-0 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
            {icon}
          </span>
        ) : null}
        {label}
      </FormLabel>
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
  /** Off when the row around it already shows a calendar icon. */
  showIcon?: boolean;
};

/** "Viernes, 06/11/2026": short weekday on phones, date alone on the smallest. */
const StepperDateText = ({ text }: { text: string }) => {
  const [weekday, date] = text.split(', ');
  if (!date) return text;
  return (
    <>
      <span className="max-[359px]:hidden">
        <span className="md:hidden">{weekday.slice(0, 3)}</span>
        <span className="hidden md:inline">{weekday}</span>
        ,&nbsp;
      </span>
      {date}
    </>
  );
};

const DateStepperFrame = ({
  value,
  label,
  placeholder,
  disabled,
  onStep,
  onPick,
  trailing,
  showIcon = true,
}: DateStepperFrameProps) => {
  const display = value ? formatStepperDate(value) : placeholder;
  return (
    <div className="flex items-center gap-2">
      {showIcon ? (
        <CalendarDays
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
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
          {value ? <StepperDateText text={display} /> : display}
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
  showIcon,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  disabled?: boolean;
  showIcon?: boolean;
}) => (
  <DateStepperFrame
    value={value}
    label={label}
    placeholder={value}
    disabled={disabled}
    showIcon={showIcon}
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
