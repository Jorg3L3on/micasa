'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';

type SimulateLoanControlProps = {
  idPrefix: string;
  title: string;
  rate: string;
  term: string;
  fee: string;
  onRateChange: (value: string) => void;
  onTermChange: (value: string) => void;
  onFeeChange: (value: string) => void;
  active: boolean;
};

export const SimulateLoanControl = ({
  idPrefix,
  title,
  rate,
  term,
  fee,
  onRateChange,
  onTermChange,
  onFeeChange,
  active,
}: SimulateLoanControlProps) => (
  <fieldset className="space-y-3 rounded-xl border border-border/60 bg-card px-4 py-4">
    <legend className="px-1 text-sm font-medium">{title}</legend>
    <p className="text-sm text-muted-foreground">{PLAN_COPY.simDisclaimer}</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-rate`}>{PLAN_COPY.rate}</Label>
        <Input
          id={`${idPrefix}-rate`}
          inputMode="decimal"
          autoComplete="off"
          placeholder=" "
          value={rate}
          onChange={(event) => onRateChange(event.target.value)}
          aria-label={PLAN_COPY.rate}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-term`}>{PLAN_COPY.term}</Label>
        <Input
          id={`${idPrefix}-term`}
          inputMode="numeric"
          autoComplete="off"
          placeholder=" "
          value={term}
          onChange={(event) => onTermChange(event.target.value)}
          aria-label={PLAN_COPY.term}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-fee`}>{PLAN_COPY.fee}</Label>
        <Input
          id={`${idPrefix}-fee`}
          inputMode="decimal"
          autoComplete="off"
          placeholder=" "
          value={fee}
          onChange={(event) => onFeeChange(event.target.value)}
          aria-label={PLAN_COPY.fee}
        />
      </div>
    </div>
    {active ? null : <p className="text-sm text-muted-foreground">{PLAN_COPY.simPending}</p>}
  </fieldset>
);
