'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/EmptyState';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { Trash2, UserPlus } from 'lucide-react';

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
  const { context } = useFinanceContext();
  const [users, setUsers] = useState<HouseUserItem[]>([]);
  const [role, setRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const isOwner = role === 'owner';

  const fetchUsers = async () => {
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
  };

  useEffect(() => {
    if (context.type === 'house') {
      fetchUsers();
    } else {
      setLoading(false);
      setUsers([]);
    }
  }, [context]);

  useEffect(() => {
    if (addUserDialogOpen) {
      setAddUserEmail('');
      setAddUserError(null);
    }
  }, [addUserDialogOpen]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = addUserEmail.trim();
    if (!email) {
      setAddUserError('El email es requerido');
      return;
    }
    setAddUserLoading(true);
    setAddUserError(null);
    try {
      await clientFetchFromApi('/api/house-users', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }, context);
      setAddUserDialogOpen(false);
      toast.success('Usuario agregado al hogar');
      await fetchUsers();
    } catch (err) {
      setAddUserError(
        err instanceof Error ? err.message : 'Error al agregar el usuario',
      );
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleRemove = async (userId: number) => {
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
  };

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
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      });
    }
    return base;
  }, [isOwner, removingId, handleRemove]);

  if (context.type !== 'house') {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="py-8 text-center text-muted-foreground">
            Select a house to manage its users
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {isOwner && (
        <div
          className="sticky top-20 z-20 mb-4 flex justify-end bg-background/95 py-2 backdrop-blur supports-backdrop-filter:bg-background/80"
          aria-label="Acciones de usuarios de la casa"
        >
          <Button onClick={() => setAddUserDialogOpen(true)}>
            <UserPlus />
            Agregar usuario
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Cargando...
            </div>
          ) : users.length === 0 ? (
            <EmptyState message="No hay usuarios en este hogar" />
          ) : (
            <DataTable
              data={users}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre..."
              emptyMessage="No hay usuarios en este hogar."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUserSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="add-user-email">Email</Label>
                <Input
                  id="add-user-email"
                  type="email"
                  value={addUserEmail}
                  onChange={(e) => setAddUserEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  disabled={addUserLoading}
                  required
                  aria-label="Email del usuario"
                  aria-invalid={!!addUserError}
                />
              </div>
              {addUserError && (
                <p className="text-destructive text-sm" role="alert">
                  {addUserError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddUserDialogOpen(false)}
                disabled={addUserLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={addUserLoading}>
                {addUserLoading ? 'Agregando…' : 'Agregar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
