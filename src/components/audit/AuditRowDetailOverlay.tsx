'use client';

import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';
import { ACTION_LABELS } from '@/lib/audit/labels';
import { formatAuditDayHeading, formatAuditTime } from '@/lib/audit/format';
import type { AuditRowDto } from '@/types/audit';
import { AuditChangeTable, AuditSourceBadge, auditActorName } from './audit-parts';

/** One change: who, when, and the field-by-field diff. Read-only. */
export function AuditRowDetailOverlay({
  row,
  open,
  onOpenChange,
}: {
  row: AuditRowDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={row ? `${ACTION_LABELS[row.action].label} de ${row.entityTypeLabel.toLowerCase()}` : 'Cambio'}
      description="Quién hizo el cambio, cuándo y el valor anterior y el nuevo de cada campo."
      dismissLabel="Cerrar"
    >
      {row ? (
        <div className="flex flex-col gap-3">
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Registro">
              <p className="truncate text-sm font-medium" title={row.entityLabel ?? undefined}>
                {row.entityLabel ?? `${row.entityTypeLabel} #${row.entityId}`}
              </p>
            </GroupedRow>
            <GroupedRow label="Quién">
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span>{auditActorName(row.actor)}</span>
                <AuditSourceBadge actor={row.actor} />
              </div>
            </GroupedRow>
            <GroupedRow label="Cuándo">
              <p className="text-sm">
                {formatAuditDayHeading(row.occurredAt)} · {formatAuditTime(row.occurredAt)}
              </p>
            </GroupedRow>
            {row.label ? (
              <GroupedRow label="Acción">
                <p className="text-sm">{row.label}</p>
              </GroupedRow>
            ) : null}
          </div>
          <OverlaySectionLabel>Campos</OverlaySectionLabel>
          <AuditChangeTable changes={row.changes} />
        </div>
      ) : null}
    </ResponsiveOverlay>
  );
}
