'use client';

import { useId } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OverlayWarning,
} from '@/components/overlay/overlay-form';
import {
  CARD_BANK_CHARGE_REASON_OPTIONS,
  isCardBankChargeReason,
  overDebtNoticeMessage,
  type CardBankChargeReasonValue,
} from '@/components/credit-cards/over-debt-reason';

type OverDebtReasonFieldsProps = {
  excess: number;
  reason: CardBankChargeReasonValue | null;
  onReasonChange: (reason: CardBankChargeReasonValue) => void;
  onSelectOpenChange: (open: boolean) => void;
};

/** Amber notice plus the required reason row. Hidden when the amount is not above the debt. */
export const OverDebtReasonFields = ({
  excess,
  reason,
  onReasonChange,
  onSelectOpenChange,
}: OverDebtReasonFieldsProps) => {
  const reasonId = useId();
  if (excess <= 0) return null;

  return (
    <>
      <OverlayWarning>{overDebtNoticeMessage(excess)}</OverlayWarning>
      <div className={OVERLAY_GROUPED_CARD_CLASS}>
        <GroupedRow label="Motivo" htmlFor={reasonId}>
          <Select
            value={reason ?? undefined}
            onValueChange={(value) => {
              if (isCardBankChargeReason(value)) onReasonChange(value);
            }}
            onOpenChange={onSelectOpenChange}
          >
            <SelectTrigger
              id={reasonId}
              className={OVERLAY_ROW_TRIGGER_CLASS}
              aria-label="Motivo del cargo"
            >
              <SelectValue placeholder="Elige" />
            </SelectTrigger>
            <SelectContent>
              {CARD_BANK_CHARGE_REASON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </GroupedRow>
      </div>
    </>
  );
};
