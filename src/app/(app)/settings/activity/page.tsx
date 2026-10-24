'use client';

import { Download, Plus, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuditChangesPanel } from '@/components/audit/AuditChangesPanel';
import { AuditRowDetailOverlay } from '@/components/audit/AuditRowDetailOverlay';
import { AuditSessionsPanel } from '@/components/audit/AuditSessionsPanel';
import { FilterChip } from '@/components/filter-chip';
import { useOptionalQuickCapture } from '@/components/quick-capture/QuickCaptureHost';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import { useFinanceContext } from '@/context/finance-context';
import {
  ToolbarFiltersPortal,
  useRegisterToolbarActions,
  type ToolbarOverflowItem,
} from '@/context/toolbar-actions-context';
import {
  auditExportHref,
  fetchAuditBatches,
  fetchAuditRows,
  fetchAuditSessions,
  type AuditFilters,
} from '@/lib/api/audit';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { formatAuditRelative } from '@/lib/audit/format';
import { addCalendarDays, todayCalendarDate } from '@/lib/calendar-dates';
import { PAGE_CREATE_ACTION } from '@/lib/ui/page-create-action';
import type { AuditRowDto, AuthEventDto } from '@/types/audit';

type Tab = 'changes' | 'sessions';
type Period = 'all' | '7' | '30' | '90';
type Action = 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE';
type Member = { id: number; name: string };

const TABS = [
  { value: 'changes', label: 'Cambios' },
  { value: 'sessions', label: 'Sesiones' },
] as const;

const ENTITY_FILTERS: { value: string; label: string }[] = [
  { value: 'Expense', label: 'Gastos' },
  { value: 'Income', label: 'Ingresos' },
  { value: 'Wallet', label: 'Billeteras' },
  { value: 'CreditCardPayment', label: 'Pagos de tarjeta' },
  { value: 'Loan', label: 'Préstamos' },
  { value: 'Budget', label: 'Presupuestos' },
  { value: 'Category', label: 'Categorías' },
  { value: 'HouseMember', label: 'Miembros' },
];

const ACTION_FILTERS: { value: Action; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'CREATE', label: 'Creaciones' },
  { value: 'UPDATE', label: 'Ediciones' },
  { value: 'DELETE', label: 'Eliminaciones' },
];

const PERIOD_FILTERS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
];

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 eyebrow text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/** Switching house / account switches the log: the view remounts with fresh filters. */
export default function ActivityPage() {
  const { context } = useFinanceContext();
  return <ActivityView key={`${context.type}-${context.id}`} />;
}

function ActivityView() {
  const { context } = useFinanceContext();
  const { data: session } = useSession();
  const myUserId = Number(session?.user?.id) || undefined;
  const isHouse = context.type === 'house';

  const [tab, setTab] = useState<Tab>('changes');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [personId, setPersonId] = useState<number | null>(null);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('ALL');
  const [period, setPeriod] = useState<Period>('all');
  const [includeFortnights, setIncludeFortnights] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<{ id: string; label: string } | null>(null);
  const [detailRow, setDetailRow] = useState<AuditRowDto | null>(null);

  useEffect(() => {
    if (!isHouse) return;
    let cancelled = false;
    clientFetchFromApi<{ users: { id: number; name: string }[] }>('/api/house-users', undefined, context)
      .then(({ users }) => {
        if (!cancelled) setMembers(users.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [context, isHouse]);

  const filters = useMemo<AuditFilters>(() => {
    const today = todayCalendarDate();
    return {
      actorUserId: personId ?? undefined,
      entityType: entityType ?? undefined,
      action: action === 'ALL' ? undefined : action,
      from: period === 'all' ? undefined : addCalendarDays(today, -Number(period) + 1),
      to: period === 'all' ? undefined : today,
      includeFortnights: includeFortnights || undefined,
      sessionId: sessionFilter?.id,
    };
  }, [personId, entityType, action, period, includeFortnights, sessionFilter]);

  const loadBatches = useCallback(
    (cursor?: string) => fetchAuditBatches(filters, context, cursor),
    [filters, context],
  );
  const loadBatchRows = useCallback(
    (batchKey: string) => fetchAuditRows({ ...filters, batchId: batchKey }, context),
    [filters, context],
  );
  const sessionsUserId = isHouse ? (personId ?? undefined) : undefined;
  const loadEvents = useCallback(
    (cursor?: string) => fetchAuditSessions({ userId: sessionsUserId }, context, cursor),
    [sessionsUserId, context],
  );

  const activeCount =
    (personId ? 1 : 0) + (entityType ? 1 : 0) + (action !== 'ALL' ? 1 : 0) + (period !== 'all' ? 1 : 0) + (includeFortnights ? 1 : 0);

  const handleExport = useCallback(() => {
    window.location.assign(auditExportHref(filters, context));
  }, [filters, context]);

  const overflowItems = useMemo<ToolbarOverflowItem[]>(
    () =>
      tab === 'changes'
        ? [
            {
              key: 'export',
              label: 'Exportar CSV',
              description: 'Los cambios con los filtros actuales',
              onClick: handleExport,
              icon: <Download className="h-4 w-4 shrink-0" aria-hidden />,
            },
          ]
        : [],
    [tab, handleExport],
  );

  // No alta of its own: the header keeps "Agregar gasto o ingreso".
  const quickCapture = useOptionalQuickCapture();
  const primaryActionIcon = useMemo(() => <Plus data-icon="inline-start" />, []);

  useRegisterToolbarActions({
    primaryAction: quickCapture
      ? {
          label: PAGE_CREATE_ACTION.expenseOrIncome.label,
          onClick: quickCapture.open,
          icon: primaryActionIcon,
        }
      : null,
    filters: { open: filtersOpen, onOpenChange: setFiltersOpen, activeCount },
    overflow: overflowItems.length ? { items: overflowItems } : null,
  });

  const showSessionChanges = useCallback((event: AuthEventDto) => {
    if (!event.sessionId) return;
    const who = event.userName ? `${event.userName} · ` : '';
    setSessionFilter({ id: event.sessionId, label: `Sesión de ${who}${formatAuditRelative(event.occurredAt)}` });
    setTab('changes');
  }, []);

  const people: Member[] = isHouse ? members : [];

  return (
    <>
      <div className="space-y-5">
        <SegmentedControl
          value={tab}
          onValueChange={(value) => setTab(value === 'sessions' ? 'sessions' : 'changes')}
          ariaLabel="Vista de actividad"
          stretch
          className="mx-auto w-full max-w-[22rem]"
          options={TABS}
        />

        {tab === 'changes' && sessionFilter ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{sessionFilter.label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Quitar filtro de sesión"
              onClick={() => setSessionFilter(null)}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        {tab === 'changes' ? (
          <AuditChangesPanel loadBatches={loadBatches} loadBatchRows={loadBatchRows} onOpenRow={setDetailRow} />
        ) : (
          <AuditSessionsPanel
            loadEvents={loadEvents}
            showPerson={isHouse}
            emptyDescription={
              isHouse
                ? 'Aquí aparecen los inicios y cierres de sesión de los miembros de la casa.'
                : 'Aquí aparecen tus inicios de sesión, cambios de contraseña y conexiones.'
            }
            onShowSessionChanges={showSessionChanges}
          />
        )}
      </div>

      <ToolbarFiltersPortal>
        <div className="space-y-4">
          {people.length > 0 || myUserId ? (
            <FilterGroup label="Persona">
              <FilterChip selected={personId === null} onClick={() => setPersonId(null)}>
                Todos
              </FilterChip>
              {myUserId ? (
                <FilterChip selected={personId === myUserId} onClick={() => setPersonId(myUserId)}>
                  Mis cambios
                </FilterChip>
              ) : null}
              {people
                .filter((m) => m.id !== myUserId)
                .map((m) => (
                  <FilterChip key={m.id} selected={personId === m.id} onClick={() => setPersonId(m.id)}>
                    {m.name}
                  </FilterChip>
                ))}
            </FilterGroup>
          ) : null}
          {tab === 'changes' ? (
            <>
              <FilterGroup label="Tipo">
                <FilterChip selected={entityType === null} onClick={() => setEntityType(null)}>
                  Todo
                </FilterChip>
                {ENTITY_FILTERS.map((f) => (
                  <FilterChip key={f.value} selected={entityType === f.value} onClick={() => setEntityType(f.value)}>
                    {f.label}
                  </FilterChip>
                ))}
              </FilterGroup>
              <FilterGroup label="Acción">
                {ACTION_FILTERS.map((f) => (
                  <FilterChip key={f.value} selected={action === f.value} onClick={() => setAction(f.value)}>
                    {f.label}
                  </FilterChip>
                ))}
              </FilterGroup>
              <FilterGroup label="Periodo">
                {PERIOD_FILTERS.map((f) => (
                  <FilterChip key={f.value} selected={period === f.value} onClick={() => setPeriod(f.value)}>
                    {f.label}
                  </FilterChip>
                ))}
              </FilterGroup>
              <FilterGroup label="Quincenas">
                <FilterChip selected={includeFortnights} onClick={() => setIncludeFortnights((v) => !v)}>
                  Mostrar periodos creados
                </FilterChip>
              </FilterGroup>
            </>
          ) : null}
        </div>
      </ToolbarFiltersPortal>

      <AuditRowDetailOverlay
        row={detailRow}
        open={detailRow !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      />
    </>
  );
}
