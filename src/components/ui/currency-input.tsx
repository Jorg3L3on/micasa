'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CurrencyInputProps = {
  value: unknown;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function CurrencyInput({
  value,
  onChange,
  className,
  placeholder = '0',
  disabled,
}: CurrencyInputProps) {
  const num = Number(value) || 0;
  const displayValue =
    num > 0
      ? new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(num)
      : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    if (raw === '' || raw === '.') {
      onChange(0);
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onChange(parsed);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
        $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        className={cn('pl-7', className)}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
