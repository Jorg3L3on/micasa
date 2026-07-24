import Link from 'next/link';
import { Search } from 'lucide-react';
import { searchAdminUsers } from '@/lib/server/admin/users';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDisplayDate } from '@/lib/calendar-dates';

type AdminHomePageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminHomePage({
  searchParams,
}: AdminHomePageProps) {
  const { q } = await searchParams;
  const users = await searchAdminUsers({ q, take: 50 });

  return (
    <div className="space-y-6" role="region" aria-label="Usuarios">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busca por nombre o correo para investigar soporte y recuperación de
          acceso.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        role="search"
        aria-label="Buscar usuarios"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Nombre o correo…"
            className="h-9 pl-8"
            aria-label="Nombre o correo"
          />
        </div>
        <Button type="submit" className="h-9 shrink-0">
          Buscar
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Usuario</th>
              <th className="px-3 py-2.5 hidden sm:table-cell">Estado</th>
              <th className="px-3 py-2.5 hidden md:table-cell">Alta</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  No hay usuarios que coincidan.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-border/60 transition-colors hover:bg-muted/40"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {user.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      {user.email}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={user.active ? 'secondary' : 'destructive'}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {user.onboarding_completed ? null : (
                        <Badge variant="outline">Sin onboarding</Badge>
                      )}
                      {user.is_admin ? (
                        <Badge variant="outline">Admin</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-[11px] text-muted-foreground">
                    {formatDisplayDate(user.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
