'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from '@/lib/api';
import {
  BadgeCheck,
  BookmarkIcon,
  Pencil,
  Trash2,
  WalletIcon,
} from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

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

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet) => (
                  <TableRow
                    key={wallet.id}
                    className={wallet.active ? '' : 'text-slate-900/50'}
                  >
                    <TableCell className="font-medium">{wallet.name}</TableCell>
                    <TableCell>{formatCurrency(wallet.amount)}</TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType]}
                    </TableCell>
                    <TableCell>
                      {wallet.active ? (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            <BadgeCheck data-icon="inline-start" />
                            Activo
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="outline">
                          <BookmarkIcon data-icon="inline-end" />
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              setSelectedWallet(null);
              setFormError(null);
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedWallet.name,
              amount: selectedWallet.amount,
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
