'use client';

import { useCallback, useMemo, useState } from 'react';
import { AuditChangesPanel } from '@/components/audit/AuditChangesPanel';
import { AuditRowDetailOverlay } from '@/components/audit/AuditRowDetailOverlay';
import { AuditSessionsPanel } from '@/components/audit/AuditSessionsPanel';
import { FilterChip } from '@/components/filter-chip';
import { SegmentedControl } from '@/components/segmented-control';
import { Input } from '@/components/ui/input';
import { auditQueryString } from '@/lib/api/audit';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import type { AuditBatchDto, AuditPage, AuditRowDto, AuthEventDto } from '@/types/audit';

type Tab = 'changes' | 'sessions';

const TABS = [
  { value: 'changes', label: 'Cambios' },
  { value: 'sessions', label: 'Sesiones' },
] as const;

const positiveId = (value: string): number | undefined => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * Cross-tenant audit for MiCasa support: every house and user, the rows
 * written outside the app, failed logins on unknown emails, and the older
 * admin actions (AdminAuditLog).
 */
export default function AdminAuditPage() {
  const [tab, setTab] = useState<Tab>('changes');
  const [ownerType, setOwnerType] = useState<'house' | 'user'>('house');
  const [ownerIdInput, setOwnerIdInput] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [ip, setIp] = useState('');
  const [missingActor, setMissingActor] = useState(false);
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [detailRow, setDetailRow] = useState<AuditRowDto | null>(null);

  const ownerId = positiveId(ownerIdInput);
  const userId = positiveId(userIdInput);

  const changeQuery = useMemo(
    () => ({
      ownerType: ownerId ? ownerType : undefined,
      ownerId,
      actorUserId: userId,
      missingActor: missingActor || undefined,
    }),
    [ownerType, ownerId, userId, missingActor],
  );

  const loadBatches = useCallback(
    (cursor?: string) =>
      clientFetchFromApi<AuditPage<AuditBatchDto>>(
        `/api/admin/audit${auditQueryString(changeQuery, { groupBy: 'batch', limit: 30, cursor })}`,
      ),
    [changeQuery],
  );
  const loadBatchRows = useCallback(
    (batchKey: string) =>
      clientFetchFromApi<AuditPage<AuditRowDto>>(
        `/api/admin/audit${auditQueryString({ ...changeQuery, batchId: batchKey }, { limit: 200 })}`,
      ),
    [changeQuery],
  );
  const loadEvents = useCallback(
    (cursor?: string) =>
      clientFetchFromApi<AuditPage<AuthEventDto>>(
        `/api/admin/audit/sessions${auditQueryString(
          { userId, ip: ip.trim() || undefined, unknownOnly: unknownOnly || undefined },
          { limit: 40, cursor },
        )}`,
      ),
    [userId, ip, unknownOnly],
  );

  return (
    <div className="space-y-5" role="region" aria-label="Auditoría">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Auditoría</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cambios y sesiones de todas las casas y cuentas, incluidos los hechos fuera de la app.
        </p>
      </div>

      <SegmentedControl
        value={tab}
        onValueChange={(value) => setTab(value === 'sessions' ? 'sessions' : 'changes')}
        ariaLabel="Vista de auditoría"
        stretch
        className="w-full max-w-[22rem]"
        options={TABS}
      />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
        {tab === 'changes' ? (
          <>
            <FilterChip selected={ownerType === 'house'} onClick={() => setOwnerType('house')}>
              Casa
            </FilterChip>
            <FilterChip selected={ownerType === 'user'} onClick={() => setOwnerType('user')}>
              Cuenta
            </FilterChip>
            <Input
              value={ownerIdInput}
              onChange={(event) => setOwnerIdInput(event.target.value)}
              inputMode="numeric"
              placeholder={ownerType === 'house' ? 'Id de casa' : 'Id de cuenta'}
              aria-label={ownerType === 'house' ? 'Id de casa' : 'Id de cuenta'}
              className="h-9 w-32"
            />
          </>
        ) : null}
        <Input
          value={userIdInput}
          onChange={(event) => setUserIdInput(event.target.value)}
          inputMode="numeric"
          placeholder="Id de usuario"
          aria-label="Id de usuario"
          className="h-9 w-32"
        />
        {tab === 'changes' ? (
          <FilterChip selected={missingActor} onClick={() => setMissingActor((v) => !v)}>
            Solo fuera de la app
          </FilterChip>
        ) : (
          <>
            <Input
              value={ip}
              onChange={(event) => setIp(event.target.value)}
              placeholder="IP"
              aria-label="IP"
              className="h-9 w-36"
            />
            <FilterChip selected={unknownOnly} onClick={() => setUnknownOnly((v) => !v)}>
              Solo correos desconocidos
            </FilterChip>
          </>
        )}
      </div>

      {tab === 'changes' ? (
        <AuditChangesPanel loadBatches={loadBatches} loadBatchRows={loadBatchRows} onOpenRow={setDetailRow} />
      ) : (
        <AuditSessionsPanel
          loadEvents={loadEvents}
          showPerson
          emptyDescription="No hay eventos con estos filtros."
        />
      )}

      <AuditRowDetailOverlay
        row={detailRow}
        open={detailRow !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      />
    </div>
  );
}
