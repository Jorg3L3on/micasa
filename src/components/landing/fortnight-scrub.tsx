import { Money } from '@/components/money';
import { STATUS_SOFT_CLASS, STATUS_TEXT_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';

type FortnightRow = {
  label: string;
  value: number;
};

type FortnightCardProps = {
  period: string;
  rows: FortnightRow[];
  due: number;
};

const FIRST_ROWS: FortnightRow[] = [
  { label: 'Nómina', value: 18500 },
  { label: 'Despensa', value: -1860 },
];

const SECOND_ROWS: FortnightRow[] = [
  { label: 'Nómina', value: 18500 },
  { label: 'Renta', value: -8500 },
  { label: 'Servicios', value: -640 },
  { label: 'Préstamo', value: -1500 },
];

const FortnightCard = ({ period, rows, due }: FortnightCardProps) => {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="overline text-muted-foreground">{period}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-body text-foreground">{row.label}</span>
            <Money value={row.value} size="row" />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/60 pt-3">
        <span className={cn('rounded-xl px-2 py-1 text-caption', STATUS_SOFT_CLASS.pending)}>
          Toca pagar
        </span>
        <Money
          value={due}
          size="row"
          tone="neutral"
          className={STATUS_TEXT_CLASS.pending}
        />
      </div>
    </article>
  );
};

/**
 * Desktop with motion holds the pair in a short sticky stage (140vh).
 * At 390px, and whenever reduced motion is on, the cards are normal flow.
 */
export const FortnightScrub = () => {
  return (
    <div className="landing-fortnight-stage">
      <div className="landing-fortnight-sticky grid gap-4 md:grid-cols-2">
        <FortnightCard period="1ª quincena" rows={FIRST_ROWS} due={1860} />
        <FortnightCard period="2ª quincena" rows={SECOND_ROWS} due={10640} />
      </div>
    </div>
  );
};
