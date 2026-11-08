'use client';

import { useState } from 'react';
import { CalendarCheck, CircleSlash, MoveRight } from 'lucide-react';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OverlayErrorBanner,
  OverlayHint,
  OverlayListRow,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';
import { Button } from '@/components/ui/button';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { stepDateLabel } from '@/components/wallets/liquidity/plan/step-format';
import { collectCardPlans, noWriteReason } from '@/lib/finance/cash-plan/apply-plan-mapping';
import { fromCents } from '@/lib/finance/cash-plan/money';
import type { ActionInstance, Obligation } from '@/lib/finance/cash-plan/types';
import { formatCurrency } from '@/lib/utils';

type ActivatePlanSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeTitle: string;
  actions: readonly ActionInstance[];
  obligations: readonly Obligation[];
  todayYmd: string;
  /** Sends the route; resolves when the server answered, rejects with the message to show. */
  onConfirm: () => Promise<void>;
};

/** What "Activar" will do, in plain words, before anything is written. */
export const planWritePreview = (actions: readonly ActionInstance[], obligations: readonly Obligation[], todayYmd: string) => {
  const writes = [
    ...collectCardPlans(actions, obligations).map((plan) => ({
      key: `card-${plan.walletId}`,
      kind: 'card' as const,
      title: PLAN_COPY.activateCardWrite(formatCurrency(fromCents(plan.amountCents)), plan.label),
      subtitle: stepDateLabel(plan.dueDate, todayYmd) ?? PLAN_COPY.stepNoDate,
    })),
    ...actions
      .filter((step) => step.type === 'defer_nonessential')
      .map((step, index) => ({
        key: `defer-${step.obligationId ?? index}`,
        kind: 'move' as const,
        title: step.label,
        subtitle: PLAN_COPY.activateMoveWrite,
      })),
  ];
  const unchanged = actions
    .map((step) => ({ step, reason: noWriteReason(step) }))
    .filter((item): item is { step: ActionInstance; reason: string } => item.reason != null)
    .map(({ step, reason }, index) => ({ key: `${step.type}-${index}`, title: step.label, subtitle: reason }));
  return { writes, unchanged };
};

/**
 * Confirmation before "Activar este plan" writes: Dialog on desktop, bottom
 * Sheet on phones. Lists each write and each step that stays as it is.
 * Nothing is stored until Activar; an error keeps the sheet open to retry.
 */
export const ActivatePlanSheet = ({
  open,
  onOpenChange,
  routeTitle,
  actions,
  obligations,
  todayYmd,
  onConfirm,
}: ActivatePlanSheetProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { writes, unchanged } = planWritePreview(actions, obligations, todayYmd);

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : PLAN_COPY.activateError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={PLAN_COPY.activate}
      description={PLAN_COPY.activateDescription}
      busy={busy}
    >
      {open ? (
        <div className="flex flex-col gap-3">
          <OverlayHint role="status">{PLAN_COPY.activateLead(routeTitle)}</OverlayHint>
          {error ? (
            <OverlayErrorBanner>
              <p className="font-medium">{error}</p>
            </OverlayErrorBanner>
          ) : null}

          {writes.length > 0 ? (
            <>
              <OverlaySectionLabel>{PLAN_COPY.activateWritesLabel}</OverlaySectionLabel>
              <div className={OVERLAY_GROUPED_CARD_CLASS} data-testid="activate-writes">
                {writes.map((item) => (
                  <OverlayListRow
                    key={item.key}
                    icon={item.kind === 'card' ? <CalendarCheck /> : <MoveRight />}
                    title={item.title}
                    subtitle={item.subtitle}
                  />
                ))}
              </div>
            </>
          ) : (
            <OverlayHint>{PLAN_COPY.activateNothing}</OverlayHint>
          )}

          {unchanged.length > 0 ? (
            <>
              <OverlaySectionLabel>{PLAN_COPY.activateUnchangedLabel}</OverlaySectionLabel>
              <div className={OVERLAY_GROUPED_CARD_CLASS} data-testid="activate-unchanged">
                {unchanged.map((item) => (
                  <OverlayListRow key={item.key} icon={<CircleSlash />} title={item.title} subtitle={item.subtitle} />
                ))}
              </div>
            </>
          ) : null}

          <OverlayHint>{PLAN_COPY.activateHint}</OverlayHint>

          <Button
            type="button"
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
            disabled={busy || writes.length === 0}
            onClick={handleConfirm}
          >
            {busy ? PLAN_COPY.activating : error ? PLAN_COPY.retry : PLAN_COPY.activateConfirm}
          </Button>
        </div>
      ) : null}
    </ResponsiveOverlay>
  );
};
