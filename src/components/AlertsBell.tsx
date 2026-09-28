'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { STATUS_SOFT_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { useFinanceContext } from '@/context/finance-context';
import type { FinanceContextType } from '@/types/finance-context';
import { useClientMounted } from '@/hooks/use-client-mounted';
import { getAppHomeHref } from '@/lib/fortnight-calendar';

const STORAGE_KEY_BASE = 'micasa-alerts-seen';
const DISMISSED_STORAGE_KEY_BASE = 'micasa-alerts-dismissed';

const storageKeyForContext = (context: FinanceContextType): string => {
  if (context.type === 'user' && context.id === 0) {
    return STORAGE_KEY_BASE;
  }
  return `${STORAGE_KEY_BASE}:${context.type}:${context.id}`;
};

const dismissedStorageKeyForContext = (context: FinanceContextType): string => {
  if (context.type === 'user' && context.id === 0) {
    return DISMISSED_STORAGE_KEY_BASE;
  }
  return `${DISMISSED_STORAGE_KEY_BASE}:${context.type}:${context.id}`;
};

type AlertItem = {
  id?: string;
  type: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  target?: {
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
  };
  fingerprint?: string;
};

type AlertsResponse = {
  period: { year: number; month: number; period: string };
  alerts: AlertItem[];
};

const severityConfig = {
  error: {
    icon: AlertTriangle,
    iconClass: STATUS_SOFT_CLASS.overdue,
  },
  warning: {
    icon: AlertCircle,
    iconClass: STATUS_SOFT_CLASS.pending,
  },
  info: {
    icon: Info,
    iconClass: STATUS_SOFT_CLASS.info,
  },
};

function getAlertId(
  period: { year: number; month: number; period: string },
  alert: AlertItem,
): string {
  if (alert.fingerprint) return alert.fingerprint;
  return `${period.year}-${period.month}-${period.period}-${alert.type}`;
}

function loadSeenIds(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(storageKey: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

function buildAlertHref(
  alert: AlertItem,
  context: FinanceContextType,
): string {
  if (alert.target?.path) {
    const params = new URLSearchParams(buildOwnerQuery(context));
    Object.entries(alert.target.query ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      params.set(key, String(value));
    });
    const query = params.toString();
    return query ? `${alert.target.path}?${query}` : alert.target.path;
  }
  const ownerQs = buildOwnerQuery(context).toString();
  return getAppHomeHref(ownerQs);
}

const AlertsBody = ({
  loading,
  error,
  data,
  alerts,
  period,
  seenIds,
  context,
  onOpenAlert,
  onDismiss,
}: {
  loading: boolean;
  error: string | null;
  data: AlertsResponse | null;
  alerts: AlertItem[];
  period: AlertsResponse['period'] | null;
  seenIds: Set<string>;
  context: FinanceContextType;
  onOpenAlert: (alert: AlertItem) => void;
  onDismiss: (id: string) => void;
}) => {
  if (loading && !data) {
    return (
      <div className="space-y-2 py-2" aria-busy="true" aria-label="Cargando alertas">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !data) {
    return <ErrorBanner>{error}</ErrorBanner>;
  }

  if (data && alerts.length === 0) {
    return <EmptyState message="No hay alertas en este periodo." className="py-6" />;
  }

  if (!data || !period) return null;

  return (
    <ul className="flex flex-col gap-1" role="list">
      {alerts.map((alert) => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;
        const id = getAlertId(period, alert);
        const isSeen = seenIds.has(id);
        return (
          <li
            key={id}
            className={cn(
              'flex items-start gap-2 rounded-xl px-2 py-2 text-sm',
              isSeen && 'opacity-70',
            )}
          >
            <Link
              href={buildAlertHref(alert, context)}
              onClick={() => onOpenAlert(alert)}
              className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/45"
              aria-label={`Ver alerta: ${alert.title}`}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                  config.iconClass,
                )}
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block font-medium leading-tight">{alert.title}</span>
                <span className="block text-caption leading-snug text-muted-foreground">
                  {alert.description}
                </span>
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Eliminar alerta: ${alert.title}`}
              onClick={() => onDismiss(id)}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
};

export function AlertsBell() {
  const mounted = useClientMounted();
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { context } = useFinanceContext();
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const seenStorageKey = storageKeyForContext(context);
  const dismissedStorageKey = dismissedStorageKeyForContext(context);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientFetchFromApi<AlertsResponse>(
        '/api/alerts',
        undefined,
        context,
      );
      setData({ period: res.period, alerts: res.alerts ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las alertas');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    setSeenIds(loadSeenIds(seenStorageKey));
  }, [seenStorageKey]);

  useEffect(() => {
    setDismissedIds(loadSeenIds(dismissedStorageKey));
  }, [dismissedStorageKey]);

  useEffect(() => {
    setData(null);
    fetchAlerts();
  }, [fetchAlerts]);

  const markSeen = useCallback(
    (id: string) => {
      setSeenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveSeenIds(seenStorageKey, next);
        return next;
      });
    },
    [seenStorageKey],
  );

  const dismissAlert = useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveSeenIds(dismissedStorageKey, next);
        return next;
      });
      markSeen(id);
    },
    [dismissedStorageKey, markSeen],
  );

  const period = data?.period ?? null;
  const allAlerts = data?.alerts ?? [];
  const alerts =
    period === null
      ? []
      : allAlerts.filter((a) => !dismissedIds.has(getAlertId(period, a)));
  const unseenCount =
    period === null
      ? 0
      : alerts.filter((a) => !seenIds.has(getAlertId(period, a))).length;

  const handleAlertClick = useCallback(
    (alert: AlertItem) => {
      if (!period) return;
      const id = getAlertId(period, alert);
      markSeen(id);
      setOpen(false);
    },
    [period, markSeen],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next && isMobile) setOpenMobile(false);
      if (next && (error || !data)) fetchAlerts();
    },
    [error, data, fetchAlerts, isMobile, setOpenMobile],
  );

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-9"
        aria-label="Alertas"
        tabIndex={0}
        disabled
      >
        <Bell className="size-5 opacity-60" aria-hidden data-icon="inline-start" />
      </Button>
    );
  }

  const bellButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative size-9"
      aria-label="Alertas"
      tabIndex={0}
      onClick={isMobile ? () => handleOpenChange(!open) : undefined}
    >
      <Bell className="size-5" aria-hidden />
      {unseenCount > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-overdue px-1 text-caption font-medium text-white"
          aria-label={`${unseenCount} alertas sin ver`}
        >
          {unseenCount > 99 ? '99+' : unseenCount}
        </span>
      ) : null}
    </Button>
  );

  const body = (
    <AlertsBody
      loading={loading}
      error={error}
      data={data}
      alerts={alerts}
      period={period}
      seenIds={seenIds}
      context={context}
      onOpenAlert={handleAlertClick}
      onDismiss={dismissAlert}
    />
  );

  if (isMobile) {
    return (
      <>
        {bellButton}
        <ResponsiveOverlay
          open={open}
          onOpenChange={handleOpenChange}
          title="Alertas"
          description="Avisos del periodo actual."
          dismissLabel="Cerrar"
        >
          {body}
        </ResponsiveOverlay>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{bellButton}</DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        className="w-80 max-h-[min(50vh,22rem)] overflow-y-auto p-2"
      >
        <p className="px-2 py-1.5 text-sm font-medium">Alertas y avisos</p>
        {body}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
