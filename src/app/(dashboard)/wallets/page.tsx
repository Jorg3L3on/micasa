'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import WalletForm from '@/components/WalletForm';
import { WalletFormValues } from '@/schemas/wallet.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import {
  clientFetchFromApi,
  createWallet,
  updateWallet,
  updateWalletStatus,
  deleteWallet,
} from '@/lib/api';
import {
  Pencil,
  Trash2,
  WalletIcon,
} from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { formatCurrency, cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

export default function WalletsPage() {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletListItem | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<WalletListItem[]>(
        '/api/wallets',
        undefined,
        context,
      );
      setWallets(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar las billeteras',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [context]);

  const handleCreate = async (data: WalletFormValues) => {
    try {
      setFormError(null);
      await createWallet(
        {
          name: data.name,
          amount: data.amount || 0,
          type: data.type,
          active: data.active || true,
          cutoff_day: data.cutoff_day || null,
          due_day: data.due_day || null,
        },
        context,
      );
      toast.success('Billetera creada');
      await fetchWallets();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear la billetera';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: WalletFormValues) => {
    if (!selectedWallet) return;
    try {
      setFormError(null);
      await updateWallet(selectedWallet.id, data, context);
      toast.success('Billetera actualizada');
      await fetchWallets();
      setEditDialogOpen(false);
      setSelectedWallet(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar la billetera';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedWallet) return;
    try {
      setError(null);
      await deleteWallet(selectedWallet.id, context);
      toast.success('Billetera eliminada');
      await fetchWallets();
      setDeleteDialogOpen(false);
      setSelectedWallet(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar la billetera';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict') ||
        message.includes('related')
      ) {
        setError('La billetera está en uso y no puede eliminarse');
      } else {
        setError(message);
      }
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedWallet) return
    try {
      setFormError(null)
      await updateWalletStatus(selectedWallet.id, !selectedWallet.active);
      toast.success('Estatus de Cartera actualizada')
      await fetchWallets()
      setUpdateStatusDialogOpen(false)
      setSelectedWallet(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar estatus de la cartera';
      setFormError(message);
      throw err;
    }
  }

  const openEditDialog = (wallet: WalletListItem) => {
    setSelectedWallet(wallet);
    setEditDialogOpen(true);
    setFormError(null);
  };

  const openDeleteDialog = (wallet: WalletListItem) => {
    setSelectedWallet(wallet);
    setDeleteDialogOpen(true);
    setError(null);
  };

  const columns = useMemo<ColumnDef<WalletListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nombre" />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              'font-medium',
              !row.original.active && 'text-muted-foreground'
            )}
          >
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Monto" />
        ),
        cell: ({ row }) => formatCurrency(row.original.amount),
      },
      {
        accessorKey: 'remaining_amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Monto restante" />
        ),
        cell: ({ row }) => {
          const remaining = row.original.remaining_amount;
          return (
            <span
              className={cn(
                'font-medium',
                remaining < 0 && 'text-destructive',
                remaining >= 0 && remaining < row.original.amount * 0.2 && 'text-amber-600 dark:text-amber-400',
                remaining >= row.original.amount * 0.2 && 'text-green-700 dark:text-green-400',
              )}
            >
              {formatCurrency(remaining)}
            </span>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) =>
          PAYMENT_METHOD_LABELS[row.original.type as PaymentMethodType],
      },
      {
        accessorKey: 'active',
        header: 'Estado',
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex px-2 py-0.5 text-xs font-medium rounded-full',
              row.original.active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
            )}
          >
            {row.original.active ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="text-right">Acciones</span>,
        cell: ({ row }) => {
          const wallet = row.original;
          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(wallet)}
                aria-label={`Editar ${wallet.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openDeleteDialog(wallet)}
                aria-label={`Eliminar ${wallet.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [openEditDialog, openDeleteDialog]
  );

  return (
    <>
      <div
        className="sticky top-20 z-20 mb-4 flex justify-end bg-background/95 py-2 backdrop-blur supports-backdrop-filter:bg-background/80"
        aria-label="Acciones de billeteras"
      >
        <Button onClick={() => setCreateDialogOpen(true)}>
          <WalletIcon />
          Agregar billetera
        </Button>
      </div>

      {error && !deleteDialogOpen && (
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
          ) : wallets.length === 0 ? (
            <EmptyState message="No se encontraron billeteras" />
          ) : (
            <DataTable
              data={wallets}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre..."
              emptyMessage="No se encontraron billeteras."
            />
          )}
        </CardContent>
      </Card>

      <WalletForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          setFormError(null);
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedWallet && (
        <>
          <WalletForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setSelectedWallet(null);
                setFormError(null);
              }
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedWallet.name,
              amount: selectedWallet.amount ?? 0,
              type: selectedWallet.type as PaymentMethodType,
              active: selectedWallet.active,
              cutoff_day: selectedWallet.cutoff_day,
              due_day: selectedWallet.due_day,
            }}
            error={formError && editDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setSelectedWallet(null);
                setError(null);
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar billetera"
            description="¿Estás seguro de querer eliminar esta billetera? Esta acción no puede deshacerse."
            itemName={selectedWallet.name}
          />

          <ConfirmDeleteDialog
            open={updateStatusDialogOpen}
            onOpenChange={(open) => {
              setUpdateStatusDialogOpen(open)
              if (!open) {
                setSelectedWallet(null)
                setError(null)
              }
            }}
            onConfirm={handleUpdateStatus}
            title="Actualizar Estatus de cartera"
            description="¿Estás seguro de querer actualizar esta cartera?"
            itemName={selectedWallet.name}
          />
        </>
      )}
    </>
  );
}
