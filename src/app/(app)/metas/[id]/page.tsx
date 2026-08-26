'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Archive,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Lightbulb,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import WalletForm from '@/components/WalletForm';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import WalletTransferDialog from '@/components/wallets/WalletTransferDialog';
import WalletQuickIncomeDialog from '@/components/wallets/WalletQuickIncomeDialog';
import { WalletMovementsFeed } from '@/components/wallets/WalletMovementFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  useRegisterToolbarActions,
  type ToolbarOverflowItem,
} from '@/context/toolbar-actions-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
} from '@/lib/api/client-fetch';
import {
  deleteWallet,
  updateWallet,
  updateWalletStatus,
} from '@/lib/api/wallets';
import { computeGoalMetrics, GOAL_STATUS_LABEL } from '@/lib/finance/goal-metrics';
import {
  getGoalActiveCardStyle,
  getGoalOverdueCardStyle,
  goalCardShellClass,
  goalMetricInkClass,
  goalMetricPanelClass,
  goalProgressFillClass,
  goalProgressTrackClass,
  goalSolidIconClass,
  goalStatusBadgeClass,
  goalTipStripClass,
  resolveGoalVisualStyle,
} from '@/components/wallets/goal-status-styles';

import { todayCalendarDate, formatDisplayDate } from '@/lib/calendar-dates';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletFormValues } from '@/schemas/wallet.schema';
import type { WalletListItem } from '@/types/catalog';
import type {
  WalletDetail,
  WalletMovementsResponse,
} from '@/types/wallet-movements';

const firstDayOfMonth = (year: number, monthIdx: number): string =>
  `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;

const lastDayOfMonth = (year: number, monthIdx: number): string => {
  const last = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
};

export default function MetaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { context } = useFinanceContext();
  const ownerQs = buildOwnerQuery(context).toString();
  const listHref = `/metas${ownerQs ? `?${ownerQs}` : ''}`;

  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [allWallets, setAllWallets] = useState<WalletListItem[]>([]);
  const [movements, setMovements] = useState<WalletMovementsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!context || !Number.isFinite(id)) return;
    if (!opts?.silent) setLoading(true);
    try {
      const today = todayCalendarDate();
      const [y, m] = today.split('-').map(Number);
      const from = firstDayOfMonth(y, m - 1);
      const to = lastDayOfMonth(y, m - 1);
      const [detail, list, mov] = await Promise.all([
        clientFetchFromApi<WalletDetail>(
          `/api/wallets/${id}`,
          undefined,
          context,
        ),
        clientFetchFromApi<WalletListItem[]>(
          '/api/wallets',
          undefined,
          context,
        ),
        clientFetchFromApi<WalletMovementsResponse>(
          `/api/wallets/${id}/movements?from=${from}&to=${to}`,
          undefined,
          context,
        ),
      ]);
      if (detail.type !== 'GOAL') {
        toast.error('Esta billetera no es una meta');
        setWallet(null);
        return;
      }
      setWallet(detail);
      setAllWallets(list);
      setMovements(mov);
    } catch {
      toast.error('No se pudo cargar la meta');
      setWallet(null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [context, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    if (!wallet) return null;
    return computeGoalMetrics({
      amount: wallet.amount,
      goal_amount: wallet.goal_amount,
      goal_due_date: wallet.goal_due_date,
      created_at: wallet.created_at,
      active: wallet.active,
    });
  }, [wallet]);

  const goalFlags = useMemo(() => {
    if (!wallet || !metrics) {
      return {
        isFunded: false,
        visual: null as ReturnType<typeof resolveGoalVisualStyle> | null,
        isFinishedVisual: false,
        isArchived: false,
        canSaveAndArchive: false,
        canTransfer: false,
      };
    }
    const isFunded =
      metrics.goalAmount > 0 && wallet.amount >= metrics.goalAmount;
    const visual = resolveGoalVisualStyle(metrics.status, isFunded);
    const isArchived = metrics.status === 'archived';
    return {
      isFunded,
      visual,
      isFinishedVisual: visual === 'finished',
      isArchived,
      canSaveAndArchive:
        (metrics.status === 'active' || metrics.status === 'overdue') &&
        !isFunded,
      canTransfer: !isArchived && wallet.amount > 0,
    };
  }, [wallet, metrics]);

  const {
    visual,
    isFinishedVisual,
    isArchived,
    canSaveAndArchive,
    canTransfer,
  } = goalFlags;

  const handleOpenIncome = useCallback(() => setIncomeOpen(true), []);
  const handleOpenTransfer = useCallback(() => setTransferOpen(true), []);
  const handleOpenBalance = useCallback(() => setBalanceOpen(true), []);
  const handleOpenEdit = useCallback(() => {
    setFormError(null);
    setEditOpen(true);
  }, []);
  const handleOpenComplete = useCallback(() => setCompleteOpen(true), []);
  const handleOpenDelete = useCallback(() => setDeleteOpen(true), []);

  const finishComplete = useCallback(async () => {
    if (!wallet) return;
    try {
      await updateWalletStatus(wallet.id, false, context);
      toast.success('Meta archivada');
      setPendingComplete(false);
      await load({ silent: true });
    } catch {
      toast.error('No se pudo archivar la meta');
    }
  }, [wallet, context, load]);

  const handleRestore = useCallback(async () => {
    if (!wallet) return;
    try {
      await updateWalletStatus(wallet.id, true, context);
      toast.success('Meta restaurada');
      await load({ silent: true });
    } catch {
      toast.error('No se pudo restaurar la meta');
    }
  }, [wallet, context, load]);

  const primaryActionIcon = useMemo(
    () => <Plus data-icon="inline-start" />,
    [],
  );

  const overflowItems = useMemo((): ToolbarOverflowItem[] => {
    if (!wallet || !metrics) return [];
    const items: ToolbarOverflowItem[] = [];

    if (isArchived) {
      items.push({
        key: 'restore',
        label: 'Restaurar',
        onClick: () => {
          void handleRestore();
        },
        icon: <RotateCcw data-icon="inline-start" />,
      });
      items.push({
        key: 'delete',
        label: 'Eliminar',
        onClick: handleOpenDelete,
        icon: <Trash2 data-icon="inline-start" />,
        destructive: true,
      });
      return items;
    }

    if (canTransfer) {
      items.push({
        key: 'transfer',
        label: 'Transferir',
        onClick: handleOpenTransfer,
        icon: <ArrowLeftRight data-icon="inline-start" />,
      });
    }

    if (canSaveAndArchive) {
      items.push(
        {
          key: 'adjust',
          label: 'Ajustar',
          onClick: handleOpenBalance,
          icon: <SlidersHorizontal data-icon="inline-start" />,
        },
        {
          key: 'complete',
          label: 'Archivar',
          onClick: handleOpenComplete,
          icon: <CheckCircle2 data-icon="inline-start" />,
        },
      );
    }

    items.push({
      key: 'edit',
      label: 'Editar',
      onClick: handleOpenEdit,
      icon: <Pencil data-icon="inline-start" />,
    });

    return items;
  }, [
    wallet,
    metrics,
    isArchived,
    canTransfer,
    canSaveAndArchive,
    handleRestore,
    handleOpenDelete,
    handleOpenTransfer,
    handleOpenBalance,
    handleOpenComplete,
    handleOpenEdit,
  ]);

  useRegisterToolbarActions({
    primaryAction:
      wallet && canSaveAndArchive
        ? {
            label: 'Ahorrar',
            onClick: handleOpenIncome,
            icon: primaryActionIcon,
          }
        : null,
    overflow: overflowItems.length > 0 ? { items: overflowItems } : null,
  });

  const handleEdit = async (data: WalletFormValues) => {
    if (!context || !wallet) return;
    setFormError(null);
    try {
      await updateWallet(
        wallet.id,
        { ...data, type: 'GOAL', include_in_liquidity: false },
        context,
      );
      toast.success('Meta actualizada');
      setEditOpen(false);
      await load({ silent: true });
    } catch {
      setFormError('No se pudo actualizar');
      throw new Error('update failed');
    }
  };

  const handleComplete = () => {
    if (!wallet) return;
    setCompleteOpen(false);
    if (wallet.amount > 0) {
      setPendingComplete(true);
      setTransferOpen(true);
      return;
    }
    void finishComplete();
  };

  const handleDelete = async () => {
    if (!context || !wallet) return;
    try {
      await deleteWallet(wallet.id, context);
      toast.success('Meta eliminada');
      setDeleteOpen(false);
      router.push(listHref);
    } catch {
      toast.error('No se pudo eliminar la meta');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!wallet || !metrics || !visual) {
    return (
      <div className="py-10 text-center">
        <p className="text-muted-foreground">Meta no encontrada</p>
        <Button asChild variant="ghost" className="mt-3">
          <Link href={listHref}>Volver a Metas</Link>
        </Button>
      </div>
    );
  }

  const tipRounded = Math.round(metrics.monthlyTip * 100) / 100;
  const savedPct = Math.round(metrics.savedProgress * 100);
  const { status } = metrics;

  const daysLabel = isArchived
    ? 'Archivada'
    : status === 'overdue'
      ? 'Fecha límite vencida'
      : metrics.daysLeft === 1
        ? '1 día restante'
        : `${metrics.daysLeft} días restantes`;

  const StatusIcon =
    status === 'archived'
      ? Archive
      : status === 'overdue'
        ? Clock
        : isFinishedVisual
          ? Check
          : Target;
  const statusIconStroke = isFinishedVisual || status === 'archived' ? 2.5 : 2.25;

  const summaryCardStyle =
    visual === 'muted'
      ? getGoalOverdueCardStyle()
      : visual === 'active'
        ? getGoalActiveCardStyle()
        : undefined;

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            goalSolidIconClass(visual),
          )}
          aria-hidden
        >
          <StatusIcon className="h-4 w-4" strokeWidth={statusIconStroke} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{wallet.name}</h2>
          <p className="text-xs text-muted-foreground">
            {wallet.goal_due_date
              ? formatDisplayDate(wallet.goal_due_date)
              : 'Sin fecha límite'}
          </p>
        </div>
        {status !== 'active' || isFinishedVisual ? (
          <Badge variant="secondary" className={cn(goalStatusBadgeClass(visual))}>
            {isFinishedVisual
              ? GOAL_STATUS_LABEL.achieved
              : GOAL_STATUS_LABEL[status]}
          </Badge>
        ) : null}
      </div>

      <section
        className={cn(
          'rounded-xl border p-4 shadow-sm',
          goalCardShellClass(visual),
        )}
        style={summaryCardStyle}
      >
        <div className={goalMetricPanelClass(visual)}>
          {isFinishedVisual ? (
            <>
              <p
                className={cn(
                  'text-center text-lg font-semibold tracking-tight sm:text-xl',
                  goalMetricInkClass(visual),
                )}
              >
                ¡Meta completada!
              </p>
              <p className="mt-1.5 text-center text-sm text-muted-foreground">
                Ahorrado{' '}
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    goalMetricInkClass(visual),
                  )}
                >
                  {formatCurrency(wallet.amount)}
                </span>{' '}
                de{' '}
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    goalMetricInkClass(visual),
                  )}
                >
                  {formatCurrency(metrics.goalAmount)}
                </span>
              </p>
            </>
          ) : (
            <>
              <p
                className={cn(
                  'text-center font-mono text-3xl font-semibold tabular-nums tracking-tight',
                  goalMetricInkClass(visual),
                )}
              >
                {formatCurrency(metrics.remaining)}
              </p>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Ahorrado{' '}
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    goalMetricInkClass(visual),
                  )}
                >
                  {formatCurrency(wallet.amount)}
                </span>{' '}
                de{' '}
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    goalMetricInkClass(visual),
                  )}
                >
                  {formatCurrency(metrics.goalAmount)}
                </span>
                <span className="text-muted-foreground/80"> · {daysLabel}</span>
              </p>
            </>
          )}

          <div className="mt-5 space-y-1.5">
            <div
              className={cn(
                'relative h-2.5 w-full overflow-hidden rounded-full',
                goalProgressTrackClass(visual),
              )}
            >
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out',
                  goalProgressFillClass(visual),
                )}
                style={{
                  width: `${isFinishedVisual ? 100 : savedPct}%`,
                }}
                aria-label={`${isFinishedVisual ? 100 : savedPct}% ahorrado`}
              />
            </div>
            <p
              className={cn(
                'text-center text-xs font-semibold tabular-nums',
                visual === 'active' || isFinishedVisual
                  ? goalMetricInkClass(visual)
                  : 'text-muted-foreground',
              )}
            >
              {isFinishedVisual ? '100%' : `${savedPct}%`}
            </p>
          </div>
        </div>

        {canSaveAndArchive && tipRounded > 0 ? (
          <div
            className={cn(
              'mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
              goalTipStripClass(visual),
            )}
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Deberías ahorrar{' '}
              <span className="font-mono font-semibold tabular-nums">
                {formatCurrency(tipRounded)}
              </span>{' '}
              este mes.
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Movimientos del mes</h3>
        </div>
        {movements ? (
          <WalletMovementsFeed
            movements={movements.movements}
            ownerQueryString={ownerQs}
            onAddTransaction={() => setIncomeOpen(true)}
            addTransactionLabel="Registrar ingreso"
            canRegister={canSaveAndArchive}
          />
        ) : null}
      </section>

      <WalletForm
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleEdit}
        mode="edit"
        allowedTypes={['GOAL']}
        defaultValues={{
          name: wallet.name,
          amount: wallet.amount,
          credit_limit: null,
          temporary_credit_limit: null,
          type: 'GOAL',
          provider_icon_key: wallet.provider_icon_key as never,
          active: wallet.active,
          include_in_liquidity: false,
          cutoff_day: null,
          due_day: null,
          goal_amount: wallet.goal_amount,
          goal_due_date: wallet.goal_due_date,
          assignee_user_id: wallet.assignee_user_id,
        }}
        error={formError}
      />

      {context ? (
        <>
          <WalletQuickIncomeDialog
            open={incomeOpen}
            onOpenChange={setIncomeOpen}
            walletId={wallet.id}
            walletName={wallet.name}
            context={context}
            onSuccess={() => load({ silent: true })}
          />
          <WalletTransferDialog
            open={transferOpen}
            onOpenChange={(open) => {
              if (!open) {
                setTransferOpen(false);
                if (pendingComplete) void finishComplete();
              } else {
                setTransferOpen(true);
              }
            }}
            wallets={allWallets}
            defaultFromWalletId={wallet.id}
            context={context}
            onSuccess={() => load({ silent: true })}
          />
          <WalletBalanceDialog
            open={balanceOpen}
            onOpenChange={setBalanceOpen}
            walletId={wallet.id}
            walletName={wallet.name}
            currentAmount={wallet.amount}
            context={context}
            onSuccess={() => load({ silent: true })}
          />
        </>
      ) : null}

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar meta</AlertDialogTitle>
            <AlertDialogDescription>
              Se marcará como archivada (inactiva).
              {wallet.amount > 0
                ? ' Después podrás transferir el saldo a otra billetera.'
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar meta"
        description={
          wallet.amount > 0
            ? `¿Eliminar esta meta? El saldo de ${formatCurrency(wallet.amount)} se perderá. Esta acción no se puede deshacer.`
            : '¿Eliminar esta meta? Esta acción no se puede deshacer.'
        }
        itemName={wallet.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
