'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

/** Strip non-digits; cap length so mobile keyboards cannot overflow day fields. */
export const sanitizeDayDigits = (raw: string, maxLength = 2): string =>
  raw.replace(/\D/g, '').slice(0, maxLength);

/** Parse committed text into a bounded day or null when empty/invalid. */
export const commitBoundedDay = (
  text: string,
  min: number,
  max: number,
): number | null => {
  const digits = sanitizeDayDigits(text);
  if (digits === '') {
    return null;
  }

  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
};

type BoundedDayFieldInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur: () => void;
  min: number;
  max: number;
  className?: string;
  'aria-label': string;
  placeholder?: string;
};

/**
 * Day-of-month field that keeps a local digit string while typing so partial
 * values (e.g. "1" before "16") are not rejected on each keystroke — fixes
 * iPad/mobile number pads with min > 9 and controlled type="number" quirks.
 */
export const BoundedDayFieldInput = ({
  value,
  onChange,
  onBlur,
  min,
  max,
  className,
  'aria-label': ariaLabel,
  placeholder,
}: BoundedDayFieldInputProps) => {
  const [text, setText] = useState(() => (value == null ? '' : String(value)));

  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = sanitizeDayDigits(event.target.value);
    setText(digits);

    if (digits === '') {
      onChange(null);
      return;
    }

    const parsed = Number.parseInt(digits, 10);
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const committed = commitBoundedDay(text, min, max);
    onChange(committed);
    setText(committed == null ? '' : String(committed));
    onBlur();
  };

  return (
    <Input
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};
