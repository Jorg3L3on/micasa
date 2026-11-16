import { Money } from '@/components/money';
import type {
  NetByPeriod,
  ScheduledKind,
  ScheduledSummary as ScheduledSummaryData,
} from '@/lib/ui/scheduled-items';
import { STATUS_TEXT_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';
import { countLine, splitPercent } from './scheduled-rows';
import { QUINCENA_DOT_CLASS, QUINCENA_BAR_CLASS } from './scheduled-tokens';

type ScheduledSummaryProps = {
  kind: ScheduledKind;
  summary: ScheduledSummaryData;
  /** Active items that repeat. */
  programados: number;
  /** Active subscriptions that repeat (expenses). */
  subscriptions: number;
  /** Ingresos: "Queda tras gastos" per quincena; null or absent = no cell. */
  net?: NetByPeriod | null;
};

const EYEBROW_CLASS =
  'flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground';

/** A negative net uses the expense tone; otherwise the given tone. */
const netClass = (value: number, otherwise?: string) =>
  value < 0 ? STATUS_TEXT_CLASS.expense : otherwise;

const NET_LABEL = 'Queda tras gastos';

const Dot = ({ period }: { period: 'FIRST' | 'SECOND' }) => (
  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', QUINCENA_DOT_CLASS[period])} />
);

/**
 * One calm card split by hairlines. No coloured left border and no
 * metric-strip class: Jorge's exception for these two screens (MIC-IDEA6).
 */
export const ScheduledSummary = ({
  kind,
  summary,
  programados,
  subscriptions,
  net = null,
}: ScheduledSummaryProps) => {
  const split = splitPercent(summary.first.total, summary.second.total);
  const showSubscriptions = kind === 'expense';
  const monthNote = [
    `${programados} programado${programados === 1 ? '' : 's'}`,
    split ? `${split.first}% en la 1ª, ${split.second}% en la 2ª` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const variableNote =
    summary.monthVariableCount > 0
      ? `más ${summary.monthVariableCount} con monto variable`
      : null;

  return (
    <section
      aria-label="Resumen por quincena"
      data-testid="scheduled-summary"
      className="overflow-hidden rounded-xl border border-border/60 bg-card"
    >
      {/* From md: one row of cells split by hairlines. */}
      <div
        className={cn(
          'hidden md:grid md:divide-x md:divide-border/60',
          showSubscriptions || net ? 'md:grid-cols-4' : 'md:grid-cols-3',
        )}
      >
        <div className="flex min-w-0 flex-col gap-0.5 px-5 py-4">
          <span className={EYEBROW_CLASS}>
            <Dot period="FIRST" />
            1ª quincena
          </span>
          <Money value={summary.first.total} size="hero" tone="neutral" className="sm:text-2xl" />
          <span className="text-xs text-muted-foreground">
            {countLine(kind, summary.first.count, summary.first.variableCount)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 px-5 py-4">
          <span className={EYEBROW_CLASS}>
            <Dot period="SECOND" />
            2ª quincena
          </span>
          <Money value={summary.second.total} size="hero" tone="neutral" className="sm:text-2xl" />
          <span className="text-xs text-muted-foreground">
            {countLine(kind, summary.second.count, summary.second.variableCount)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 px-5 py-4">
          <span className={EYEBROW_CLASS}>Al mes</span>
          <Money value={summary.monthTotal} size="hero" tone="neutral" className="sm:text-2xl" />
          {split ? (
            <span aria-hidden className="my-1.5 flex h-1.5 gap-[3px]">
              <span
                className={cn('rounded-full', QUINCENA_BAR_CLASS.FIRST)}
                style={{ flex: `${split.first} 1 0` }}
              />
              <span
                className={cn('rounded-full', QUINCENA_BAR_CLASS.SECOND)}
                style={{ flex: `${split.second} 1 0` }}
              />
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">{monthNote}</span>
          {variableNote ? (
            <span className="text-xs text-muted-foreground">{variableNote}</span>
          ) : null}
        </div>
        {showSubscriptions ? (
          <div className="flex min-w-0 flex-col gap-0.5 px-5 py-4">
            <span className={EYEBROW_CLASS}>Suscripciones</span>
            <Money
              value={summary.subscriptionsMonthTotal}
              size="hero"
              tone="neutral"
              className="sm:text-2xl"
            />
            <span className="text-xs text-muted-foreground">
              {subscriptions} al mes
            </span>
          </div>
        ) : null}
        {net ? (
          <div className="flex min-w-0 flex-col gap-0.5 px-5 py-4" data-testid="scheduled-net">
            <span className={EYEBROW_CLASS}>{NET_LABEL}</span>
            <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-[15px] font-bold leading-7">
              <span>
                1ª{' '}
                <Money
                  value={net.first}
                  size="row"
                  tone="neutral"
                  className={cn('text-[15px] font-bold', netClass(net.first))}
                />
              </span>
              <span>
                2ª{' '}
                <Money
                  value={net.second}
                  size="row"
                  tone="neutral"
                  className={cn('text-[15px] font-bold', netClass(net.second))}
                />
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              ingresos menos gastos programados
            </span>
          </div>
        ) : null}
      </div>

      {/* Below md: two columns plus a footer line, no bar. */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 divide-x divide-border/60">
          {(['FIRST', 'SECOND'] as const).map((period) => {
            const data = period === 'FIRST' ? summary.first : summary.second;
            return (
              <div key={period} className="flex min-w-0 flex-col px-3.5 py-3">
                <span className={EYEBROW_CLASS}>
                  <Dot period={period} />
                  {period === 'FIRST' ? '1ª quincena' : '2ª quincena'}
                </span>
                <Money
                  value={data.total}
                  size="row"
                  tone="neutral"
                  className="text-lg font-bold"
                />
                <span className="text-xs text-muted-foreground">
                  {countLine(kind, data.count, data.variableCount, true)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 px-3.5 py-2.5 text-xs text-muted-foreground">
          <span>
            Al mes{' '}
            <Money value={summary.monthTotal} size="caption" tone="neutral" className="font-semibold text-foreground" />
          </span>
          {showSubscriptions ? (
            <span>
              Suscripciones{' '}
              <Money
                value={summary.subscriptionsMonthTotal}
                size="caption"
                tone="neutral"
                className="font-semibold text-foreground"
              />
            </span>
          ) : null}
          {net ? (
            <span className="basis-full" data-testid="scheduled-net-mobile">
              {NET_LABEL}: 1ª{' '}
              <Money
                value={net.first}
                size="caption"
                tone="positive"
                className={cn('font-semibold', netClass(net.first))}
              />{' '}
              · 2ª{' '}
              <Money
                value={net.second}
                size="caption"
                tone="positive"
                className={cn('font-semibold', netClass(net.second))}
              />
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
};
