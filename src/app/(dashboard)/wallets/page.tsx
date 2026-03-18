'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
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
  deleteWallet,
  createCreditCard,
  updateCreditCard,
} from '@/lib/api';
import {
  Banknote,
  BadgeCheck,
  BookmarkIcon,
  CreditCard,
  Eye,
  Landmark,
  Pencil,
  Store,
  Trash2,
  WalletIcon,
} from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

const CREDIT_TYPES: PaymentMethodType[] = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

const isCreditType = (type: string) =>
  CREDIT_TYPES.includes(type as PaymentMethodType);

const WALLET_ICON_CONFIG: Record<
  PaymentMethodType,
  { icon: typeof CreditCard; bg: string; fg: string }
> = {
  CASH: {
    icon: Banknote,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    fg: 'text-emerald-600 dark:text-emerald-400',
  },
  DEBIT_CARD: {
    icon: Landmark,
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    fg: 'text-blue-600 dark:text-blue-400',
  },
  CREDIT_CARD: {
    icon: CreditCard,
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    fg: 'text-violet-600 dark:text-violet-400',
  },
  DEPARTMENT_STORE_CARD: {
    icon: Store,
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    fg: 'text-violet-600 dark:text-violet-400',
  },
};

export default function WalletsPage() {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletListItem | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
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
  }, [context]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleCreate = async (data: WalletFormValues) => {
    try {
      setFormError(null);
      const payload = {
        name: data.name,
        amount: data.amount || 0,
        credit_limit: data.credit_limit ?? null,
        type: data.type,
        active: data.active || true,
        cutoff_day: data.cutoff_day || null,
        due_day: data.due_day || null,
      };

      if (isCreditType(data.type)) {
        await createCreditCard(payload, context);
        toast.success('Tarjeta creada');
      } else {
        await createWallet(payload, context);
        toast.success('Billetera creada');
      }
      await fetchWallets();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: WalletFormValues) => {
    if (!selectedWallet) return;
    try {
      setFormError(null);
      if (isCreditType(selectedWallet.type)) {
        await updateCreditCard(selectedWallet.id, data, context);
        toast.success('Tarjeta actualizada');
      } else {
        await updateWallet(selectedWallet.id, data, context);
        toast.success('Billetera actualizada');
      }
      await fetchWallets();
      setEditDialogOpen(false);
      setSelectedWallet(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedWallet) return;
    try {
      setError(null);
      await deleteWallet(selectedWallet.id, context);
      toast.success('Eliminada');
      await fetchWallets();
      setDeleteDialogOpen(false);
      setSelectedWallet(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict') ||
        message.includes('related')
      ) {
        setError('Está en uso y no puede eliminarse');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = useCallback((wallet: WalletListItem) => {
    setSelectedWallet(wallet);
    setEditDialogOpen(true);
    setFormError(null);
  }, []);

  const openDeleteDialog = useCallback((wallet: WalletListItem) => {
    setSelectedWallet(wallet);
    setDeleteDialogOpen(true);
    setError(null);
  }, []);

  const columns = useMemo<ColumnDef<WalletListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nombre" />
        ),
        cell: ({ row }) => {
          const wallet = row.original;
          const isCard = isCreditType(wallet.type);
          const config = WALLET_ICON_CONFIG[wallet.type as PaymentMethodType];
          const Icon = config?.icon ?? WalletIcon;

          return (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  config?.bg ?? 'bg-muted',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', config?.fg ?? 'text-muted-foreground')} />
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate font-medium',
                    !wallet.active && 'text-muted-foreground',
                  )}
                >
                  {wallet.name}
                </p>
                {isCard && wallet.cutoff_day != null && wallet.due_day != null && (
                  <p className="text-[10px] text-muted-foreground">
                    Corte {wallet.cutoff_day} / Pago {wallet.due_day}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Saldo" />
        ),
        cell: ({ row }) => {
          const wallet = row.original;
          const isCard = isCreditType(wallet.type);

          return (
            <span
              className={cn(
                'font-mono tabular-nums text-sm',
                isCard && wallet.amount > 0 && 'font-bold text-foreground',
              )}
            >
              {formatCurrency(wallet.amount)}
            </span>
          );
        },
      },
      {
        id: 'available',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Disponible" />
        ),
        accessorFn: (row) => {
          if (isCreditType(row.type)) {
            return row.credit_limit != null ? row.credit_limit - row.amount : null;
          }
          return row.amount;
        },
        cell: ({ row }) => {
          const wallet = row.original;
          const isCard = isCreditType(wallet.type);

          if (isCard) {
            if (wallet.credit_limit == null) {
              return <span className="text-muted-foreground">Sin línea</span>;
            }
            const available = wallet.credit_limit - wallet.amount;
            return (
              <span
                className={cn(
                  'font-mono tabular-nums text-sm font-bold',
                  available < 0
                    ? 'text-destructive'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {formatCurrency(available)}
              </span>
            );
          }

          return (
            <span
              className={cn(
                'font-mono tabular-nums text-sm',
                wallet.amount > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground',
              )}
            >
              {formatCurrency(wallet.amount)}
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
        cell: ({ row }) =>
          row.original.active ? (
            <Badge variant="secondary">
              <BadgeCheck data-icon="inline-start" />
              Activo
            </Badge>
          ) : (
            <Badge variant="outline">
              <BookmarkIcon data-icon="inline-end" />
              Inactivo
            </Badge>
          ),
      },
      {
        id: 'actions',
        header: () => <span className="text-right">Acciones</span>,
        cell: ({ row }) => {
          const wallet = row.original;
          const isCard = isCreditType(wallet.type);

          return (
            <div className="flex justify-end gap-2">
              {isCard && (
                <Button asChild variant="ghost" size="icon">
                  <Link
                    href={`/credit-cards/${wallet.id}`}
                    aria-label={`Ver estado de cuenta de ${wallet.name}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              )}
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
    [openEditDialog, openDeleteDialog],
  );

  return (
    <>
      <div
        className="sticky top-20 z-20 mb-4 flex justify-end bg-background/95 py-2 backdrop-blur supports-backdrop-filter:bg-background/80"
        aria-label="Acciones de billeteras"
      >
        <Button onClick={() => setCreateDialogOpen(true)}>
          <WalletIcon />
          Agregar billetera o tarjeta
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
            showAmountField={!isCreditType(selectedWallet.type)}
            defaultValues={{
              name: selectedWallet.name,
              amount: selectedWallet.amount ?? 0,
              credit_limit: selectedWallet.credit_limit ?? null,
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
        </>
      )}
    </>
  );
}
