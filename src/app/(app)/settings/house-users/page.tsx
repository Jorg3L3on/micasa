'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { OVERLAY_PRIMARY_BUTTON_CLASS } from '@/components/overlay/overlay-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/EmptyState';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { Trash2, UserPlus, Loader2 } from 'lucide-react';
import { useRegisterToolbarActions } from '@/context/toolbar-actions-context';

type HouseUserItem = {
  id: number;
  name: string;
  email: string;
};

type HouseUsersResponse = {
  users: HouseUserItem[];
  role: 'owner' | 'admin' | 'member';
};

export default function HouseUsersPage() {
  const router = useRouter();
  const { context } = useFinanceContext();
  const [users, setUsers] = useState<HouseUserItem[]>([]);
  const [role, setRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserEmail, setAddUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const isOwner = role === 'owner';

  useEffect(() => {
    if (context.type !== 'house') {
      router.replace('/settings/account');
    }
  }, [context.type, router]);

  const fetchUsers = useCallback(async () => {
    if (context.type !== 'house') return;
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<HouseUsersResponse>(
        '/api/house-users',
        undefined,
        context,
      );
      setUsers(data.users);
      setRole(data.role);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los usuarios',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (context.type === 'house') {
      fetchUsers();
    } else {
      setLoading(false);
      setUsers([]);
    }
  }, [context, fetchUsers]);

  useEffect(() => {
    if (addUserDialogOpen) {
      setAddUserEmail('');
      setAddUserError(null);
    }
  }, [addUserDialogOpen]);

  const inviteHouseUser = async () => {
    if (isSubmitting) return;
    const email = addUserEmail.trim();
    if (!email) {
      setAddUserError('El email es requerido');
      return;
    }
    setIsSubmitting(true);
    setAddUserError(null);
    try {
      await clientFetchFromApi(
        '/api/house-users',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
        context,
      );
      setAddUserDialogOpen(false);
      toast.success('Usuario agregado al hogar');
      await fetchUsers();
    } catch (err) {
      setAddUserError(
        err instanceof Error ? err.message : 'Error al agregar el usuario',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = useCallback(async (userId: number) => {
    try {
      setRemovingId(userId);
      setError(null);
      await clientFetchFromApi(
        `/api/house-users/${userId}`,
        { method: 'DELETE' },
        context,
      );
      toast.success('Usuario eliminado del hogar');
      await fetchUsers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar el usuario';
      setError(message);
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  }, [context, fetchUsers]);

  const columns = useMemo<ColumnDef<HouseUserItem>[]>(() => {
    const base: ColumnDef<HouseUserItem>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nombre" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.original.email,
      },
    ];
    if (isOwner) {
      base.push({
        id: 'actions',
        header: () => <span className="text-right">Acciones</span>,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(user.id)}
                disabled={removingId === user.id}
                aria-label={`Quitar ${user.name} del hogar`}
              >
                <Trash2 className="h-4 w-4 text-destructive" data-icon="inline-start" />
              </Button>
            </div>
          );
        },
      });
    }
    return base;
  }, [isOwner, removingId, handleRemove]);

  const handleOpenInvite = useCallback(() => {
    setAddUserDialogOpen(true);
  }, []);

  const primaryActionIcon = useMemo(
    () => <UserPlus data-icon="inline-start" />,
    [],
  );

  useRegisterToolbarActions({
    primaryAction: isOwner
      ? {
          label: 'Invitar usuario',
          onClick: handleOpenInvite,
          icon: primaryActionIcon,
        }
      : null,
  });

  if (context.type !== 'house') {
    return null;
  }

  return (
    <>
      <div className="space-y-5">
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="py-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Cargando…
            </div>
          ) : users.length === 0 ? (
            <EmptyState message="No hay usuarios en este hogar" />
          ) : (
            <DataTable
              data={users}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre…"
              emptyMessage="No hay usuarios en este hogar."
            />
          )}
        </CardContent>
      </Card>
      </div>

      <ResponsiveOverlay
        open={addUserDialogOpen}
        onOpenChange={setAddUserDialogOpen}
        title="Invitar usuario"
        description="Agrega a alguien a este hogar con su email de MiCasa."
        busy={isSubmitting}
      >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void inviteHouseUser();
            }}
            aria-busy={isSubmitting}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-user-email">Email</Label>
                <Input
                  id="add-user-email"
                  name="email"
                  type="email"
                  value={addUserEmail}
                  onChange={(e) => setAddUserEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  disabled={isSubmitting}
                  required
                  autoComplete="email"
                  aria-invalid={!!addUserError}
                  aria-describedby={
                    addUserError ? 'add-user-email-error' : undefined
                  }
                />
              </div>
              {addUserError && (
                <p
                  id="add-user-email-error"
                  className="text-destructive text-sm"
                  role="alert"
                >
                  {addUserError}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={OVERLAY_PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden
                    data-icon="inline-start"
                  />
                  Invitando…
                </>
              ) : (
                'Invitar'
              )}
            </Button>
          </form>
      </ResponsiveOverlay>
    </>
  );
}
