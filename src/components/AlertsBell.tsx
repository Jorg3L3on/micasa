'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { clientFetchFromApi } from '@/lib/api';

const STORAGE_KEY = 'micasa-alerts-seen';

type AlertItem = {
  type: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
};

type DashboardAlertsResponse = {
  period: { year: number; month: number; period: string };
  alerts: AlertItem[];
};

const severityConfig = {
  error: {
    icon: AlertTriangle,
    itemVariant: 'destructive' as const,
    iconClass: 'text-destructive',
  },
  warning: {
    icon: AlertCircle,
    itemVariant: 'default' as const,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    itemVariant: 'default' as const,
    iconClass: 'text-muted-foreground',
  },
};

function getAlertId(
  period: { year: number; month: number; period: string },
  alert: AlertItem,
): string {
  return `${period.year}-${period.month}-${period.period}-${alert.type}`;
}

function loadSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

const DASHBOARD_ACTIVIDAD_URL = '/dashboard?tab=actividad';

export function AlertsBell() {
  const [data, setData] = useState<DashboardAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientFetchFromApi<DashboardAlertsResponse>(
        '/api/dashboard',
      );
      setData({ period: res.period, alerts: res.alerts ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las alertas');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSeenIds(loadSeenIds());
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markSeen = useCallback((id: string) => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSeenIds(next);
      return next;
    });
  }, []);

  const period = data?.period ?? null;
  const alerts = data?.alerts ?? [];
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
      if (next && (error || !data)) fetchAlerts();
    },
    [error, data, fetchAlerts],
  );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label="Alertas"
          tabIndex={0}
        >
          <Bell className="size-5" aria-hidden />
          {unseenCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
              aria-label={`${unseenCount} alertas sin ver`}
            >
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 max-h-[min(70vh,24rem)] overflow-y-auto p-0"
      >
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Alertas y avisos</p>
        </div>
        <div className="p-1">
          {loading && !data && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span className="text-sm">Cargando…</span>
            </div>
          )}
          {error && !data && (
            <p className="py-4 px-2 text-sm text-destructive">{error}</p>
          )}
          {!loading && data && alerts.length === 0 && (
            <p className="py-4 px-2 text-sm text-muted-foreground">
              No hay alertas en este periodo.
            </p>
          )}
          {data &&
            period &&
            alerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              const id = getAlertId(period, alert);
              const isSeen = seenIds.has(id);
              return (
                <Link
                  key={id}
                  href={DASHBOARD_ACTIVIDAD_URL}
                  onClick={() => handleAlertClick(alert)}
                  className={cn(
                    'flex w-full cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                    isSeen && 'opacity-70',
                  )}
                  aria-label={`Ver en Actividad: ${alert.title}`}
                >
                  <Icon
                    className={cn('mt-0.5 size-4 shrink-0', config.iconClass)}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-medium leading-tight">{alert.title}</p>
                    <p className="text-muted-foreground text-xs leading-snug">
                      {alert.description}
                    </p>
                  </div>
                </Link>
              );
            })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
