import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CalendarRange,
  HandCoins,
  History,
  Home,
  Wallet,
} from 'lucide-react';
import {
  buildAdminRecentActivity,
  getAdminUserDetail,
} from '@/lib/server/admin/users';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/calendar-dates';

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) notFound();

  const user = await getAdminUserDetail(userId);
  if (!user) notFound();

  const recentActivity = await buildAdminRecentActivity(userId, 50);

  return (
    <div className="space-y-6" role="region" aria-label={`Usuario ${user.name}`}>
      <div className="space-y-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Volver al listado
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{user.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant={user.active ? 'secondary' : 'destructive'}>
              {user.active ? 'Activo' : 'Inactivo'}
            </Badge>
            <Badge variant="outline">
              {user.onboarding_completed
                ? 'Onboarding completo'
                : 'Sin onboarding'}
            </Badge>
            {user.is_admin ? <Badge variant="outline">Admin</Badge> : null}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Alta {formatDisplayDate(user.created_at)} · ID {user.id}
        </p>
      </div>

      <section
        className="rounded-lg border border-border/60 border-l-[3px] border-l-blue-500/50 bg-card px-4 py-3"
        aria-label="Casas"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
            <Home className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold leading-none">Casas</h2>
        </div>
        {user.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin membresías.</p>
        ) : (
          <ul className="space-y-1.5">
            {user.memberships.map((m) => (
              <li
                key={`${m.house_id}-${m.role}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>{m.house_name}</span>
                <Badge variant="outline">{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-lg border border-border/60 border-l-[3px] border-l-emerald-500/50 bg-card px-4 py-3"
        aria-label="Billeteras"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
            <Wallet
              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          </span>
          <h2 className="text-sm font-semibold leading-none">Billeteras</h2>
        </div>
        {user.wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin billeteras.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {user.wallets.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{w.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {w.type}
                    {w.active ? '' : ' · inactiva'}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(w.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-lg border border-border/60 border-l-[3px] border-l-violet-500/50 bg-card px-4 py-3"
        aria-label="Quincenas"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <CalendarRange
              className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
          </span>
          <h2 className="text-sm font-semibold leading-none">
            Quincenas recientes
          </h2>
        </div>
        {user.fortnights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin quincenas.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {user.fortnights.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {f.period} · {f.month}/{f.year}
                  </p>
                </div>
                <Badge variant={f.closed ? 'secondary' : 'outline'}>
                  {f.closed ? 'Cerrada' : 'Abierta'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-lg border border-border/60 border-l-[3px] border-l-amber-500/50 bg-card px-4 py-3"
        aria-label="Préstamos"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
            <HandCoins
              className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
          </span>
          <h2 className="text-sm font-semibold leading-none">Préstamos</h2>
        </div>
        {user.loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin préstamos.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {user.loans.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {l.lender} · {l.status}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(l.principal_amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-lg border border-border/60 border-l-[3px] border-l-slate-500/50 bg-card px-4 py-3"
        aria-label="Actividad reciente"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-500/10 dark:bg-slate-500/15">
            <History
              className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400"
              aria-hidden
            />
          </span>
          <div>
            <h2 className="text-sm font-semibold leading-none">
              Actividad reciente
            </h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Hasta 50 eventos reconstruidos desde la base (finance-log no es
              consultable).
            </p>
          </div>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos recientes.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recentActivity.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{event.label}</p>
                  {event.summary ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {event.summary}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDisplayDate(event.at)}
                  </p>
                </div>
                {event.amount != null ? (
                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                    {formatCurrency(event.amount)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
