'use client';

import {
  Bot,
  KeyRound,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAuditSessions } from '@/lib/api/audit';
import { formatAuditRelative } from '@/lib/audit/format';
import { STATUS_SOFT_CLASS, STATUS_TEXT_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';
import type { AuthEventDto } from '@/types/audit';
import type { FinanceContextType } from '@/types/finance-context';

const KIND_COPY: Record<string, { label: string; icon: LucideIcon; tone?: 'overdue' | 'success' | 'info' }> = {
  LOGIN: { label: 'Inició sesión', icon: LogIn, tone: 'success' },
  LOGOUT: { label: 'Cerró sesión', icon: LogOut },
  LOGIN_FAILED: { label: 'Intento de inicio de sesión fallido', icon: ShieldAlert, tone: 'overdue' },
  REGISTER: { label: 'Creó su cuenta', icon: UserPlus, tone: 'success' },
  PASSWORD_CHANGED: { label: 'Cambió su contraseña', icon: KeyRound },
  PASSWORD_OVERRIDDEN: { label: 'Soporte asignó una contraseña temporal', icon: ShieldCheck, tone: 'info' },
  API_KEY_CREATED: { label: 'Creó una llave de conexión', icon: Bot, tone: 'info' },
  API_KEY_REVOKED: { label: 'Revocó una llave de conexión', icon: Bot },
  OAUTH_GRANT_ISSUED: { label: 'Conectó una app', icon: Bot, tone: 'info' },
  OAUTH_GRANT_REVOKED: { label: 'Desconectó una app', icon: Bot },
  AGENT_AUTH_FAILED: { label: 'Una conexión fue rechazada', icon: ShieldAlert, tone: 'overdue' },
};

const REASON_COPY: Record<string, string> = {
  wrong_password: 'contraseña incorrecta',
  inactive: 'cuenta desactivada',
};

const eventDetail = (event: AuthEventDto): string | null => {
  if (event.kind === 'LOGIN_FAILED' && event.reason) return REASON_COPY[event.reason] ?? event.reason;
  if (event.kind === 'AGENT_AUTH_FAILED' && event.reason) return event.reason;
  const name = event.metadata?.name;
  if (typeof name === 'string') return name;
  return null;
};

/**
 * Actividad → Sesiones. Account: the caller's own events, tokens included.
 * House: every member's logins, logouts and failed attempts.
 */
export function AuditSessionsPanel({
  context,
  isHouse,
  userId,
  onShowSessionChanges,
}: {
  context: FinanceContextType;
  isHouse: boolean;
  userId?: number;
  onShowSessionChanges: (event: AuthEventDto) => void;
}) {
  const [events, setEvents] = useState<AuthEventDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchAuditSessions({ userId }, context, after);
        setEvents((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las sesiones');
      } finally {
        setLoading(false);
      }
    },
    [context, userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="py-3 sm:py-4">
          {loading && events.length === 0 ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando sesiones">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={LogIn}
              message="Sin sesiones registradas"
              description={
                isHouse
                  ? 'Aquí aparecen los inicios y cierres de sesión de los miembros de la casa.'
                  : 'Aquí aparecen tus inicios de sesión, cambios de contraseña y conexiones.'
              }
            />
          ) : (
            <ul role="list" className="divide-y divide-border/60">
              {events.map((event) => {
                const copy = KIND_COPY[event.kind] ?? { label: event.kind, icon: LogIn };
                const Icon = copy.icon;
                const detail = eventDetail(event);
                const device = [event.device, event.ip].filter(Boolean).join(' · ');
                return (
                  <li key={event.id} className="flex items-start gap-3 px-1 py-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                        copy.tone ? STATUS_SOFT_CLASS[copy.tone] : 'bg-muted',
                      )}
                    >
                      <Icon className={cn('h-4 w-4', copy.tone ? STATUS_TEXT_CLASS[copy.tone] : 'text-muted-foreground')} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm">
                        {isHouse && event.userName ? <span className="font-semibold">{event.userName} · </span> : null}
                        {copy.label}
                        {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {formatAuditRelative(event.occurredAt)}
                        {device ? ` · ${device}` : ''}
                      </p>
                      {event.kind === 'LOGIN' && event.changeCount ? (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-caption"
                          onClick={() => onShowSessionChanges(event)}
                        >
                          {event.changeCount} {event.changeCount === 1 ? 'cambio' : 'cambios'} en esta sesión
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {cursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="ghost" className="h-9 rounded-xl" disabled={loading} onClick={() => void load(cursor)}>
            {loading ? 'Cargando…' : 'Ver sesiones anteriores'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
