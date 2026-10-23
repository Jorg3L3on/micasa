'use client';

import { ChevronDown, History } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAuditBatches, fetchAuditRows, type AuditFilters } from '@/lib/api/audit';
import { auditDay, formatAuditDayHeading, formatAuditTime } from '@/lib/audit/format';
import { cn } from '@/lib/utils';
import type { AuditBatchDto, AuditRowDto } from '@/types/audit';
import type { FinanceContextType } from '@/types/finance-context';
import { AuditSourceBadge, auditActorName } from './audit-parts';

type BatchState = { rows: AuditRowDto[]; loading: boolean; error: string | null };

/**
 * Actividad → Cambios: one line per batch (request, import, tool call) grouped
 * by day. Expanding a batch lists its rows; a row opens the diff.
 */
export function AuditChangesPanel({
  context,
  filters,
  onOpenRow,
}: {
  context: FinanceContextType;
  filters: AuditFilters;
  onOpenRow: (row: AuditRowDto) => void;
}) {
  const [batches, setBatches] = useState<AuditBatchDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, BatchState>>({});

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchAuditBatches(filters, context, after);
        setBatches((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la actividad');
      } finally {
        setLoading(false);
      }
    },
    [context, filters],
  );

  useEffect(() => {
    setExpanded({});
    void load();
  }, [load]);

  const loadBatchRows = useCallback(
    async (batchKey: string): Promise<AuditRowDto[]> => {
      setExpanded((prev) => ({ ...prev, [batchKey]: { rows: prev[batchKey]?.rows ?? [], loading: true, error: null } }));
      try {
        const page = await fetchAuditRows({ ...filters, batchId: batchKey }, context);
        setExpanded((prev) => ({ ...prev, [batchKey]: { rows: page.items, loading: false, error: null } }));
        return page.items;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudieron cargar los cambios';
        setExpanded((prev) => ({ ...prev, [batchKey]: { rows: [], loading: false, error: message } }));
        return [];
      }
    },
    [context, filters],
  );

  const toggleBatch = async (batch: AuditBatchDto) => {
    if (batch.counts.total === 1) {
      const rows = expanded[batch.batchKey]?.rows.length
        ? expanded[batch.batchKey]!.rows
        : await loadBatchRows(batch.batchKey);
      if (rows[0]) onOpenRow(rows[0]);
      return;
    }
    if (expanded[batch.batchKey] && !expanded[batch.batchKey]!.loading) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[batch.batchKey];
        return next;
      });
      return;
    }
    await loadBatchRows(batch.batchKey);
  };

  const days = useMemo(() => {
    const groups: { day: string; heading: string; items: AuditBatchDto[] }[] = [];
    for (const batch of batches) {
      const day = auditDay(batch.occurredAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(batch);
      else groups.push({ day, heading: formatAuditDayHeading(batch.occurredAt), items: [batch] });
    }
    return groups;
  }, [batches]);

  return (
    <div className="space-y-3">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="py-3 sm:py-4">
          {loading && batches.length === 0 ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando actividad">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <EmptyState
              icon={History}
              message="Sin actividad para mostrar"
              description="El registro empieza el día en que se activó la actividad. Prueba quitar filtros o elegir otro periodo."
            />
          ) : (
            <div className="space-y-4">
              {days.map((group) => (
                <section key={group.day} aria-label={group.heading} className="space-y-1">
                  <h3 className="eyebrow px-1 text-muted-foreground">{group.heading}</h3>
                  <ul role="list" className="divide-y divide-border/60">
                    {group.items.map((batch) => {
                      const state = expanded[batch.batchKey];
                      const isOpen = batch.counts.total > 1 && !!state;
                      return (
                        <li key={batch.batchKey}>
                          <button
                            type="button"
                            onClick={() => void toggleBatch(batch)}
                            aria-expanded={batch.counts.total > 1 ? isOpen : undefined}
                            className="flex w-full min-h-11 items-start gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span
                              aria-hidden
                              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                            >
                              {auditActorName(batch.actor).slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 space-y-0.5">
                              <span className="block text-sm">
                                <span className="font-semibold">{auditActorName(batch.actor)}</span>{' '}
                                <span className="text-foreground/90">{batch.summary}</span>
                              </span>
                              <span className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
                                <span>{formatAuditTime(batch.occurredAt)}</span>
                                <AuditSourceBadge actor={batch.actor} />
                              </span>
                            </span>
                            {batch.counts.total > 1 ? (
                              <ChevronDown
                                aria-hidden
                                className={cn(
                                  'mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-(--motion-base)',
                                  isOpen && 'rotate-180',
                                )}
                              />
                            ) : null}
                          </button>
                          {isOpen ? (
                            <div className="mb-2 ml-11 space-y-1">
                              {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
                              {state.loading ? (
                                <Skeleton className="h-10 w-full rounded-lg" />
                              ) : (
                                <ul role="list" className="border-l border-border/60 pl-3">
                                  {state.rows.map((row) => (
                                    <li key={row.id}>
                                      <button
                                        type="button"
                                        onClick={() => onOpenRow(row)}
                                        className="flex w-full min-h-11 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      >
                                        <span className="min-w-0 truncate" title={row.summary}>
                                          {row.summary}
                                        </span>
                                        <span className="shrink-0 text-caption text-muted-foreground">
                                          {row.changes.length} {row.changes.length === 1 ? 'campo' : 'campos'}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {cursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="ghost" className="h-9 rounded-xl" disabled={loading} onClick={() => void load(cursor)}>
            {loading ? 'Cargando…' : 'Ver actividad anterior'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
