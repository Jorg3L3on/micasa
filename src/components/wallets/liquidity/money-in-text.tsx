import { Money } from '@/components/money';
import type { MoneySize, MoneyTone } from '@/lib/money';

/** es-MX currency from `formatCurrency`, including a leading ASCII minus. */
const CURRENCY_TOKEN = /(-?\$[\d,]+\.\d{2})/g;

type MoneyInTextProps = {
  text: string;
  size?: MoneySize;
  tone?: MoneyTone;
};

/** Keeps the surrounding sentence and renders each amount with `<Money>`. */
export const MoneyInText = ({
  text,
  size = 'caption',
  tone = 'neutral',
}: MoneyInTextProps) => {
  const parts = text.split(CURRENCY_TOKEN);

  return (
    <>
      {parts.map((part, index) => {
        if (!/^(-?)\$[\d,]+\.\d{2}$/.test(part)) return part;
        const negative = part.startsWith('-');
        const digits = Number(part.replace(/^-?\$/, '').replace(/,/g, ''));
        const value = (negative ? -1 : 1) * digits;
        return (
          <Money
            key={`${part}-${index}`}
            value={value}
            size={size}
            tone={tone}
          />
        );
      })}
    </>
  );
};
