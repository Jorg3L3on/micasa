'use client';

import { Money } from '@/components/money';
import {
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_SECONDARY_BUTTON_CLASS,
  OverlayHint,
} from '@/components/overlay/overlay-form';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { Button } from '@/components/ui/button';
import { ToggleField } from '@/components/ui/toggle';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { cn } from '@/lib/utils';
import { RowIcon, SubscriptionBadge } from './ScheduledRow';
import {
  ACTIVE_HELPER,
  cutoffHint,
  DETAIL_TITLE,
  detailCaption,
  detailRows,
} from './scheduled-detail';
import type { ScheduledRowModel } from './scheduled-rows';

type ScheduledDetailOverlayProps = {
  /** The row to show; null keeps the overlay closed. */
  row: ScheduledRowModel | null;
  onOpenChange: (open: boolean) => void;
  /** Saves at once; the caller updates optimistically and rolls back on error. */
  onActiveChange: (row: ScheduledRowModel, active: boolean) => void;
  /** True while the Activo change is being saved. */
  savingActive: boolean;
  onEdit: (row: ScheduledRowModel) => void;
  onRequestDelete: (row: ScheduledRowModel) => void;
};

/**
 * Read-first detail of a gasto or ingreso programado (MIC-I16-3): amount, per
 * month and per year, grouped rows, Corte from the card, the Activo toggle,
 * then Editar and Eliminar. Dialog from `md`, bottom sheet below.
 */
export const ScheduledDetailOverlay = ({
  row,
  onOpenChange,
  onActiveChange,
  savingActive,
  onEdit,
  onRequestDelete,
}: ScheduledDetailOverlayProps) => {
  const kind = row?.item.kind ?? 'expense';

  return (
    <ResponsiveOverlay
      open={row !== null}
      onOpenChange={onOpenChange}
      title={DETAIL_TITLE[kind]}
      description={row ? `Detalle de ${row.item.name}` : DETAIL_TITLE[kind]}
      dismissLabel="Cerrar"
    >
      {row ? (
        <DetailBody
          row={row}
          onActiveChange={onActiveChange}
          savingActive={savingActive}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
        />
      ) : null}
    </ResponsiveOverlay>
  );
};

const DetailBody = ({
  row,
  onActiveChange,
  savingActive,
  onEdit,
  onRequestDelete,
}: Omit<ScheduledDetailOverlayProps, 'row' | 'onOpenChange'> & {
  row: ScheduledRowModel;
}) => {
  const { item } = row;
  const caption = detailCaption(row);
  const rows = detailRows(row);
  const hint = cutoffHint(row);

  return (
    <div className="flex flex-col gap-3" data-testid="scheduled-detail">
      <div className="flex min-w-0 flex-col items-center gap-1 pb-1 text-center">
        <RowIcon
          row={row}
          className="size-12 rounded-[14px]"
          iconClassName="h-[22px] w-[22px]"
        />
        <div className="mt-1.5 flex min-w-0 max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <h3
            className="min-w-0 text-base font-semibold [overflow-wrap:anywhere]"
            data-testid="scheduled-detail-name"
          >
            {item.name}
          </h3>
          {item.isSubscription ? <SubscriptionBadge /> : null}
        </div>
        {item.amount === null ? (
          <span className="text-3xl font-bold leading-tight text-muted-foreground">
            Variable
          </span>
        ) : (
          <Money
            value={item.amount}
            size="hero"
            tone={item.kind === 'income' ? 'positive' : 'neutral'}
            className="leading-tight sm:text-[2rem]"
          />
        )}
        {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
      </div>

      {rows.length > 0 ? (
        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          {rows.map((detail) => (
            <GroupedRow key={detail.key} label={detail.label} labelWidth="wide">
              {detail.kind === 'wallet' ? (
                <span className="flex min-w-0 justify-end">
                  <WalletIdentity
                    name={detail.value}
                    providerIconKey={detail.iconKey}
                    className="max-w-full"
                    nameClassName="text-sm font-normal text-foreground/80"
                    iconClassName="h-[22px] w-[22px]"
                  />
                </span>
              ) : (
                <span className="block break-words text-right text-sm text-foreground/80">
                  {detail.value}
                </span>
              )}
            </GroupedRow>
          ))}
        </div>
      ) : null}
      {hint ? <OverlayHint>{hint}</OverlayHint> : null}

      <ToggleField
        label="Activo"
        helper={ACTIVE_HELPER}
        checked={item.active}
        disabled={savingActive}
        onCheckedChange={(next) => onActiveChange(row, next)}
        className="px-3"
      />

      <Button
        type="button"
        className={cn(OVERLAY_PRIMARY_BUTTON_CLASS, 'mt-1')}
        onClick={() => onEdit(row)}
      >
        Editar
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={cn(OVERLAY_SECONDARY_BUTTON_CLASS, 'text-destructive hover:text-destructive')}
        onClick={() => onRequestDelete(row)}
      >
        Eliminar
      </Button>
    </div>
  );
};
