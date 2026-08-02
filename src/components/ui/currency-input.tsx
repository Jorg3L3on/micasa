'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CurrencyInputProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange' | 'type'
> & {
  value: unknown;
  onChange: (val: number) => void;
};

/** Normalize locale decimal comma and strip invalid chars; keep at most one `.`. */
export const sanitizeCurrencyDraft = (raw: string): string => {
  const normalized = raw.replace(/,/g, '.');
  let result = '';
  let sawDot = false;

  for (const char of normalized) {
    if (char >= '0' && char <= '9') {
      if (sawDot) {
        const fraction = result.slice(result.indexOf('.') + 1);
        if (fraction.length >= 2) continue;
      }
      result += char;
      continue;
    }

    if (char === '.' && !sawDot) {
      result += '.';
      sawDot = true;
    }
  }

  return result;
};

/** Parse a draft to a finite number, or 0 when empty / only `.`. */
export const parseCurrencyDraft = (draft: string): number => {
  if (draft === '' || draft === '.') return 0;
  const parsed = Number.parseFloat(draft);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Commit draft on blur: empty/`.` → 0; strip trailing `.`; clamp to 2 decimals. */
export const commitCurrencyDraft = (draft: string): number => {
  const sanitized = sanitizeCurrencyDraft(draft);
  if (sanitized === '' || sanitized === '.') return 0;
  const trimmed = sanitized.endsWith('.')
    ? sanitized.slice(0, -1)
    : sanitized;
  if (trimmed === '') return 0;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
};

/** Format a committed number for display when the field is not focused. */
export const formatCurrencyDraft = (value: unknown): string => {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return '';
  const fixed = Math.round(num * 100) / 100;
  if (Number.isInteger(fixed)) return String(fixed);
  return String(fixed);
};

export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(function CurrencyInput(
  {
    value,
    onChange,
    className,
    placeholder = '0',
    disabled,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = React.useState(false);
  const [text, setText] = React.useState(() => formatCurrencyDraft(value));

  React.useEffect(() => {
    if (!focused) {
      setText(formatCurrencyDraft(value));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const draft = sanitizeCurrencyDraft(e.target.value);
    setText(draft);
    onChange(parseCurrencyDraft(draft));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const committed = commitCurrencyDraft(text);
    onChange(committed);
    setText(formatCurrencyDraft(committed));
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground"
        aria-hidden
      >
        $
      </span>
      <Input
        ref={ref}
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn('pl-7', className)}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={props['aria-label'] ?? 'Monto'}
      />
    </div>
  );
});
