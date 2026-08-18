'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { toast } from 'sonner';
import WalletForm from '@/components/WalletForm';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import WalletTransferDialog from '@/components/wallets/WalletTransferDialog';
import WalletQuickIncomeDialog from '@/components/wallets/WalletQuickIncomeDialog';
import { GoalListCard } from '@/components/wallets/GoalListCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
} from '@/lib/api/client-fetch';
import {
  createWallet,
  deleteWallet,
  updateWallet,
  updateWalletStatus,
} from '@/lib/api/wallets';
import type { WalletFormValues } from '@/schemas/wallet.schema';
import type { WalletListItem } from '@/types/catalog';
import type { PaymentMethodType } from '@/domain/payment-method';
import { compareActiveGoals, computeGoalMetrics } from '@/lib/finance/goal-metrics';
import { formatCurrency } from '@/lib/utils';

type StatusFilter = 'active' | 'completed' | 'archived';

export default function MetasPage() {
  const { context } = useFinanceContext();
  const ownerQueryString = buildOwnerQuery(context).toString();

  const [allWallets, setAllWallets] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WalletListItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [incomeWallet, setIncomeWallet] = useState<WalletListItem | null>(null);
  const [transferWallet, setTransferWallet] = useState<WalletListItem | null>(
    null,
  );
  const [completeWallet, setCompleteWallet] = useState<WalletListItem | null>(
    null,
  );
  const [pendingCompleteId, setPendingCompleteId] = useState<number | null>(
    null,
  );

  const fetchAllWallets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!context) return;
    if (!opts?.silent) setLoading(true);
    try {
      const list = await clientFetchFromApi<WalletListItem[]>(
        '/api/wallets',
        undefined,
        context,
      );
      setAllWallets(list);
    } catch {
      toast.error('No se pudieron cargar las metas');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void fetchAllWallets();
  }, [fetchAllWallets]);

  const goals = useMemo(
    () => allWallets.filter((w) => w.type === 'GOAL'),
    [allWallets],
  );

  const displayGoals = useMemo(() => {
    const filtered = goals.filter((w) => {
      const status = computeGoalMetrics({
        amount: w.amount,
        goal_amount: w.goal_amount,
        goal_due_date: w.goal_due_date,
        created_at: w.created_at,
        active: w.active,
      }).status;

      if (statusFilter === 'active') {
        return status === 'active' || status === 'overdue';
      }
      if (statusFilter === 'completed') return status === 'achieved';
      if (statusFilter === 'archived') return status === 'archived';
      return false;
    });

    if (statusFilter !== 'active') return filtered;
    return [...filtered].sort(compareActiveGoals);
  }, [goals, statusFilter]);

  const handleCreate = async (data: WalletFormValues) => {
    if (!context) return;
    setFormError(null);
    const payload = {
      ...data,
      type: 'GOAL' as const,
      include_in_liquidity: false,
    };
    try {
      await createWallet(payload, context);
      toast.success('Meta creada');
      await fetchAllWallets({ silent: true });
    } catch {
      setFormError('No se pudo crear la meta');
      throw new Error('create failed');
    }
  };

  const handleEdit = async (data: WalletFormValues) => {
    if (!context || !selected) return;
    setFormError(null);
    try {
      await updateWallet(
        selected.id,
        {
          ...data,
          type: 'GOAL',
          include_in_liquidity: false,
        },
        context,
      );
      toast.success('Meta actualizada');
      setEditOpen(false);
      setSelected(null);
      await fetchAllWallets({ silent: true });
    } catch {
      setFormError('No se pudo actualizar la meta');
      throw new Error('update failed');
    }
  };

  const handleDelete = async () => {
    if (!context || !selected) return;
    try {
      await deleteWallet(selected.id, context);
      toast.success('Meta eliminada');
      setDeleteOpen(false);
      setSelected(null);
      await fetchAllWallets({ silent: true });
    } catch {
      toast.error('No se pudo eliminar la meta');
    }
  };

  const finishComplete = async (walletId: number) => {
    try {
      await updateWalletStatus(walletId, false, context);
      toast.success('Meta archivada');
      await fetchAllWallets({ silent: true });
    } catch {
      toast.error('No se pudo archivar la meta');
    }
  };

  const handleRestore = async (wallet: WalletListItem) => {
    if (!context) return;
    try {
      await updateWalletStatus(wallet.id, true, context);
      toast.success('Meta restaurada');
      await fetchAllWallets({ silent: true });
    } catch {
      toast.error('No se pudo restaurar la meta');
    }
  };

  const handleCompleteConfirm = async () => {
    if (!context || !completeWallet) return;
    const wallet = completeWallet;
    setCompleteWallet(null);
    if (wallet.amount > 0) {
      setPendingCompleteId(wallet.id);
      setTransferWallet(wallet);
      toast.message('Transfiere el saldo y cierra el diálogo para archivar');
      return;
    }
    await finishComplete(wallet.id);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold leading-tight tracking-tight">
            Metas
          </h2>
          <p className="text-sm text-muted-foreground">
            Ahorra con un objetivo y una fecha límite.
          </p>
        </div>
        <Button
          type="button"
          className="hidden rounded-xl sm:inline-flex"
          onClick={() => {
            setFormError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Nueva meta
        </Button>
      </div>

      <div
        className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Filtrar metas"
      >
        {(
          [
            { value: 'active', label: 'Activas' },
            { value: 'completed', label: 'Completadas' },
            { value: 'archived', label: 'Archivadas' },
          ] as const
        ).map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={statusFilter === value ? 'default' : 'outline'}
            className="h-8 shrink-0 rounded-full px-3.5 text-xs"
            role="tab"
            aria-selected={statusFilter === value}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : displayGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-[oklch(96.8%_0.007_247.896)] px-6 py-14 text-center dark:bg-card/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            <Target className="h-5 w-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="font-medium">
              {statusFilter === 'active'
                ? 'No hay metas activas'
                : statusFilter === 'completed'
                  ? 'No hay metas completadas'
                  : 'No hay metas archivadas'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {statusFilter === 'active'
                ? 'Crea una meta para empezar a ahorrar con propósito.'
                : statusFilter === 'completed'
                  ? 'Cuando alcances el monto en la fecha límite, aparecerá aquí.'
                  : 'Las metas que archives se listarán en esta pestaña.'}
            </p>
          </div>
          {statusFilter === 'active' ? (
            <Button type="button" className="rounded-xl" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Nueva meta
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayGoals.map((wallet) => (
            <GoalListCard
              key={wallet.id}
              wallet={wallet}
              ownerQueryString={ownerQueryString}
              onEdit={(w) => {
                setSelected(w);
                setFormError(null);
                setEditOpen(true);
              }}
              onSaveIncome={setIncomeWallet}
              onTransfer={setTransferWallet}
              onComplete={setCompleteWallet}
              onRestore={(w) => void handleRestore(w)}
              onDelete={(w) => {
                setSelected(w);
                setDeleteOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        size="icon"
        aria-label="Nueva meta"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg sm:hidden"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <WalletForm
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          setFormError(null);
        }}
        onSave={handleCreate}
        mode="create"
        allowedTypes={['GOAL']}
        defaultValues={{
          name: '',
          amount: 0,
          credit_limit: null,
          temporary_credit_limit: null,
          type: 'GOAL',
          provider_icon_key: null,
          active: true,
          include_in_liquidity: false,
          cutoff_day: null,
          due_day: null,
          goal_amount: null,
          goal_due_date: null,
          assignee_user_id: null,
        }}
        error={formError && createOpen ? formError : null}
      />

      {selected ? (
        <WalletForm
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setSelected(null);
              setFormError(null);
            }
          }}
          onSave={handleEdit}
          mode="edit"
          allowedTypes={['GOAL']}
          defaultValues={{
            name: selected.name,
            amount: selected.amount ?? 0,
            credit_limit: null,
            temporary_credit_limit: null,
            type: 'GOAL' as PaymentMethodType,
            provider_icon_key: selected.provider_icon_key ?? null,
            active: selected.active,
            include_in_liquidity: false,
            cutoff_day: null,
            due_day: null,
            goal_amount: selected.goal_amount ?? null,
            goal_due_date: selected.goal_due_date ?? null,
            assignee_user_id: selected.assignee_user_id ?? null,
          }}
          error={formError && editOpen ? formError : null}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setSelected(null);
        }}
        title="Eliminar meta"
        description={
          selected && selected.amount > 0
            ? `¿Eliminar esta meta? El saldo de ${formatCurrency(selected.amount)} se perderá. Esta acción no se puede deshacer.`
            : '¿Eliminar esta meta? Esta acción no se puede deshacer.'
        }
        itemName={selected?.name}
        onConfirm={handleDelete}
      />

      {incomeWallet && context ? (
        <WalletQuickIncomeDialog
          open
          onOpenChange={(open) => {
            if (!open) setIncomeWallet(null);
          }}
          walletId={incomeWallet.id}
          walletName={incomeWallet.name}
          context={context}
          onSuccess={async () => {
            await fetchAllWallets({ silent: true });
          }}
        />
      ) : null}

      {context ? (
        <WalletTransferDialog
          open={transferWallet != null}
          onOpenChange={(open) => {
            if (!open) {
              const id = pendingCompleteId;
              setTransferWallet(null);
              setPendingCompleteId(null);
              if (id != null) {
                void finishComplete(id);
              }
            }
          }}
          wallets={allWallets}
          defaultFromWalletId={transferWallet?.id ?? null}
          context={context}
          onSuccess={async () => {
            await fetchAllWallets({ silent: true });
          }}
        />
      ) : null}

      <AlertDialog
        open={completeWallet != null}
        onOpenChange={(open) => {
          if (!open) setCompleteWallet(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar meta</AlertDialogTitle>
            <AlertDialogDescription>
              {completeWallet
                ? `Se marcará «${completeWallet.name}» como archivada (inactiva).${
                    completeWallet.amount > 0
                      ? ' Después podrás transferir el saldo a otra billetera.'
                      : ''
                  }`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleCompleteConfirm()}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
