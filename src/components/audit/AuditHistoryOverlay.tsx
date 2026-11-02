'use client';

import { useCallback, useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import { fetchAuditRows } from '@/lib/api/audit';
import { formatAuditRelative } from '@/lib/audit/format';
import { OVERLAY_SECONDARY_BUTTON_CLASS } from '@/components/overlay/overlay-form';
import type { AuditRowDto } from '@/types/audit';
import { AuditChangeTable, AuditSourceBadge, auditActorName } from './audit-parts';

/**
 * Historial of one record (gasto, billetera, préstamo, presupuesto): every
 * change with its diff, newest first, in the current house or account.
 */
export function AuditHistoryOverlay({
  open,
  onOpenChange,
  entityType,
  entityId,
  title = 'Historial',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: number | string;
  title?: string;
}) {
  const { context } = useFinanceContext();
  const [rows, setRows] = useState<AuditRowDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchAuditRows({ entityType, entityId: String(entityId) }, context, after);
        setRows((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
      } finally {
        setLoading(false);
      }
    },
    [context, entityType, entityId],
  );

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Cambios de este registro, del más reciente al más antiguo."
      dismissLabel="Cerrar"
    >
      <div className="flex flex-col gap-3">
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        {loading && rows.length === 0 ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando historial">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 && !error ? (
          <EmptyState
            message="Sin cambios registrados"
            description="El historial empieza a partir de que se activó el registro de actividad."
          />
        ) : (
          <ol className="flex flex-col gap-3" aria-label="Cambios">
            {rows.map((row) => (
              <li key={row.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 text-sm">
                  <span className="font-medium">{auditActorName(row.actor)}</span>
                  <span className="text-muted-foreground">{row.summary.split(':')[0]}</span>
                  <AuditSourceBadge actor={row.actor} />
                  <span className="ml-auto text-caption text-muted-foreground">
                    {formatAuditRelative(row.occurredAt)}
                  </span>
                </div>
                <AuditChangeTable changes={row.changes} />
              </li>
            ))}
          </ol>
        )}
        {cursor ? (
          <Button
            type="button"
            variant="ghost"
            className={OVERLAY_SECONDARY_BUTTON_CLASS}
            disabled={loading}
            onClick={() => void load(cursor)}
          >
            {loading ? 'Cargando…' : 'Ver cambios anteriores'}
          </Button>
        ) : null}
      </div>
    </ResponsiveOverlay>
  );
}
