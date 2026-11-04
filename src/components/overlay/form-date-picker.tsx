'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { isValidCalendarDateString, todayCalendarDate } from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';
import { OVERLAY_GROUPED_LABEL_CLASS } from '@/components/overlay/overlay-form';

/** Local civil day for a `YYYY-MM-DD` string (the day the user sees and taps). */
const ymdToLocalDate = (ymd: string): Date => {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const localDateToYmd = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const LOCALE = 'es-MX';
const FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** Each changed part of the date rolls up for a later day and down for an earlier one. */
const valueRoll: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${direction * 0.35}em`, filter: 'blur(3px)' }),
  center: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit: (direction: number) => ({ opacity: 0, y: `${direction * -0.3}em`, filter: 'blur(2px)', transition: { duration: 0.14 } }),
};
const valueFade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
const statusRise: Variants = {
  enter: { opacity: 0, y: '0.3em' },
  center: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: '-0.3em', transition: { duration: 0.14 } },
};

type FormDatePickerProps = {
  /** Required calendar day, `YYYY-MM-DD`. */
  value: string;
  onChange: (next: string) => void;
  label?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

/**
 * Date field for create overlays, adapted from the uiarc Date picker: a field
 * button whose date rolls part by part, and a calendar that opens under the
 * row with a "Hoy" shortcut and a status line. The calendar opens in the flow
 * (not as a floating layer) so the grouped card and the overlay body never
 * clip it. Inside a `<Form>` (FormItem + FormMessage).
 */
export const FormDatePicker = ({
  value,
  onChange,
  label = 'Fecha',
  icon,
  disabled,
}: FormDatePickerProps) => {
  const reduce = useReducedMotion() ?? false;
  const valid = isValidCalendarDateString(value);
  const selected = valid ? ymdToLocalDate(value) : undefined;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(selected ?? new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const formatter = new Intl.DateTimeFormat(LOCALE, FORMAT);
  const shown = selected ? formatter.format(selected) : 'Elegir fecha';
  const parts = selected ? formatter.formatToParts(selected) : [];
  const time = selected?.getTime() ?? null;
  const [previousTime, setPreviousTime] = useState(time);
  const [direction, setDirection] = useState(1);
  if (previousTime !== time) {
    setPreviousTime(time);
    setDirection(time === null || previousTime === null || time >= previousTime ? 1 : -1);
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        window.clearTimeout(closeTimer.current);
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (open) {
      panelRef.current
        ?.querySelector<HTMLButtonElement>('[data-day] button[tabindex="0"]')
        ?.focus({ preventScroll: true });
    }
  }, [open]);

  const close = () => {
    window.clearTimeout(closeTimer.current);
    if (panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    setOpen(false);
  };
  const show = () => {
    window.clearTimeout(closeTimer.current);
    setMonth(monthStart(selected ?? new Date()));
    setOpen(true);
  };
  const pick = (next: string) => {
    onChange(next);
    window.clearTimeout(closeTimer.current);
    if (reduce) close();
    else closeTimer.current = window.setTimeout(close, 300);
  };

  const partMotion = reduce ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <FormItem className="space-y-1 px-3 py-1.5">
      <div
        ref={rootRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            close();
          }
        }}
      >
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
          <FormControl>
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => (open ? close() : show())}
              onKeyDown={(event) => {
                if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  show();
                }
              }}
              className={cn(
                'flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm transition-colors',
                'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
                open && 'border-primary/40 bg-muted/40',
              )}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">{shown}</span>
              <span className="relative flex min-w-0 flex-1 font-medium tabular-nums" aria-hidden>
                {selected ? (
                  <span className="inline-flex whitespace-pre capitalize">
                    {parts.map((part, index) => (
                      <motion.span
                        key={`${index}-${part.type}`}
                        className="inline-flex whitespace-pre"
                        layout="position"
                        layoutDependency={time}
                        transition={partMotion}
                      >
                        {part.type === 'literal' ? (
                          <span>{part.value}</span>
                        ) : (
                          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                            <motion.span
                              key={part.value}
                              className="inline-block whitespace-pre"
                              custom={direction}
                              variants={reduce ? valueFade : valueRoll}
                              initial="enter"
                              animate="center"
                              exit="exit"
                            >
                              {part.value}
                            </motion.span>
                          </AnimatePresence>
                        )}
                      </motion.span>
                    ))}
                  </span>
                ) : (
                  <span className="truncate text-muted-foreground">Elegir fecha</span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  open && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          </FormControl>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label={`${label}, calendario`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-2xl border border-border bg-card p-3">
                <Calendar
                  mode="single"
                  selected={selected}
                  onSelect={(date) => {
                    if (date) pick(localDateToYmd(date));
                  }}
                  month={month}
                  onMonthChange={setMonth}
                />
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-caption text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => pick(todayCalendarDate())}
                    className="rounded-lg px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    Hoy
                  </button>
                  <span className="grid min-w-0 justify-items-end">
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={time ?? 'none'}
                        className="col-start-1 row-start-1 max-w-full truncate"
                        variants={reduce ? valueFade : statusRise}
                        initial="enter"
                        animate="center"
                        exit="exit"
                      >
                        {selected ? `Seleccionada: ${shown}` : 'Elige un día'}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <FormMessage />
    </FormItem>
  );
};
