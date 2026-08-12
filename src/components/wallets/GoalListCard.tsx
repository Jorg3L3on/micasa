'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  MoreVertical,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import {
  computeGoalMetrics,
  GOAL_STATUS_LABEL,
} from '@/lib/finance/goal-metrics';
import type { GoalVisualStyle } from '@/components/wallets/goal-status-styles';
import {
  getGoalActiveCardStyle,
  getGoalOverdueCardStyle,
  GOAL_ACTIVE_ACCENT,
  GOAL_OVERDUE_ACCENT,
  goalCardShellClass,
  goalMetricInkClass,
  goalMetricPanelClass,
  goalProgressFillClass,
  goalProgressTrackClass,
  goalSolidIconClass,
  goalStatusBadgeClass,
  resolveGoalVisualStyle,
} from '@/components/wallets/goal-status-styles';
import {
  getWalletBrandCssVars,
  WALLET_BRAND_HIT_BUTTON_CLASS,
} from '@/lib/provider-card-style';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/calendar-dates';
import type { WalletListItem } from '@/types/catalog';

type GoalListCardProps = {
  wallet: WalletListItem;
  ownerQueryString: string;
  onEdit: (wallet: WalletListItem) => void;
  onSaveIncome: (wallet: WalletListItem) => void;
  onTransfer: (wallet: WalletListItem) => void;
  onComplete: (wallet: WalletListItem) => void;
  onDelete: (wallet: WalletListItem) => void;
};

function PrimaryGoalAction({
  label,
  onClick,
  Icon,
  strokeWidth,
  visual,
  isFinishedVisual,
}: {
  label: string;
  onClick: () => void;
  Icon: LucideIcon;
  strokeWidth: number;
  visual: GoalVisualStyle;
  isFinishedVisual: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isFinishedVisual
          ? 'hover:bg-emerald-500/5'
          : visual === 'muted'
            ? 'hover:bg-[oklch(37.3%_0.034_259.733_/_.06)]'
            : 'hover:bg-blue-600/5 dark:hover:bg-blue-500/10',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          goalSolidIconClass(visual),
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={strokeWidth} aria-hidden />
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm font-semibold leading-tight',
          goalMetricInkClass(visual),
        )}
      >
        {label}
      </span>
      <ChevronRight
        className={cn('h-4 w-4 shrink-0', goalMetricInkClass(visual))}
        aria-hidden
      />
    </button>
  );
}

export const GoalListCard = ({
  wallet,
  ownerQueryString,
  onEdit,
  onSaveIncome,
  onTransfer,
  onComplete,
  onDelete,
}: GoalListCardProps) => {
  const metrics = computeGoalMetrics({
    amount: wallet.amount,
    goal_amount: wallet.goal_amount,
    goal_due_date: wallet.goal_due_date,
    created_at: wallet.created_at,
    active: wallet.active,
  });
  const { status } = metrics;
  const isArchived = status === 'archived';
  const isFunded =
    metrics.goalAmount > 0 && wallet.amount >= metrics.goalAmount;
  const visual = resolveGoalVisualStyle(status, isFunded);
  const isFinishedVisual = visual === 'finished';
  const isActiveVisual = visual === 'active';
  const canSaveAndArchive =
    (status === 'active' || status === 'overdue') && !isFunded;
  const canTransfer = !isArchived && wallet.amount > 0;

  const brandColor =
    visual === 'muted' ? GOAL_OVERDUE_ACCENT : GOAL_ACTIVE_ACCENT;
  const brandCssVars = useMemo(
    () => getWalletBrandCssVars(brandColor),
    [brandColor],
  );
  const cardStyle = useMemo(() => {
    if (isFinishedVisual) return undefined;
    if (visual === 'muted') {
      return { ...getGoalOverdueCardStyle(), ...brandCssVars };
    }
    return { ...getGoalActiveCardStyle(), ...brandCssVars };
  }, [isFinishedVisual, visual, brandCssVars]);

  const detailHref = `/metas/${wallet.id}${ownerQueryString ? `?${ownerQueryString}` : ''}`;
  const savedPct = Math.round(metrics.savedProgress * 100);
  const progressPct = isFinishedVisual ? 100 : savedPct;
  const dueDateLabel = wallet.goal_due_date
    ? formatDisplayDate(wallet.goal_due_date)
    : 'Sin fecha límite';

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
  const statusIconStroke =
    isFinishedVisual || status === 'archived' ? 2.5 : 2.25;

  const primaryAction = isFinishedVisual
    ? canTransfer
      ? {
          key: 'transfer' as const,
          label: 'Transferir',
          onClick: () => onTransfer(wallet),
          Icon: ArrowLeftRight,
        }
      : null
    : canSaveAndArchive
      ? {
          key: 'save' as const,
          label: 'Ahorrar',
          onClick: () => onSaveIncome(wallet),
          Icon: Plus,
        }
      : canTransfer
        ? {
            key: 'transfer' as const,
            label: 'Transferir',
            onClick: () => onTransfer(wallet),
            Icon: ArrowLeftRight,
          }
        : null;

  return (
    <article className="@container h-full w-full min-w-0 max-w-full">
      <Card
        className={cn(
          'flex h-full flex-col gap-0 overflow-hidden border py-0 shadow-sm',
          goalCardShellClass(visual),
        )}
        style={cardStyle}
      >
        <CardContent className="flex flex-1 flex-col gap-3 px-4 py-[1.375rem]">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                goalSolidIconClass(visual),
              )}
              aria-hidden
            >
              <StatusIcon className="h-5 w-5" strokeWidth={statusIconStroke} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">
                    {wallet.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dueDateLabel}
                  </p>
                </div>
                {status !== 'active' || isFinishedVisual ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'shrink-0 text-xs',
                      goalStatusBadgeClass(visual),
                    )}
                  >
                    {isFinishedVisual
                      ? GOAL_STATUS_LABEL.achieved
                      : GOAL_STATUS_LABEL[status]}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className={goalMetricPanelClass(visual)}>
            {isFinishedVisual ? (
              <>
                <p
                  className={cn(
                    'text-center text-lg font-semibold tracking-tight',
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
                <p className="mt-1.5 text-center text-sm text-muted-foreground">
                  Ahorrado{' '}
                  <span className="font-mono font-medium tabular-nums text-foreground/80">
                    {formatCurrency(wallet.amount)}
                  </span>{' '}
                  de{' '}
                  <span className="font-mono font-medium tabular-nums text-foreground/80">
                    {formatCurrency(metrics.goalAmount)}
                  </span>
                  <span> · {daysLabel}</span>
                </p>
              </>
            )}

            <div className="mt-4 space-y-1.5">
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
                  style={{ width: `${progressPct}%` }}
                  aria-label={`${progressPct}% ahorrado`}
                />
              </div>
              <p
                className={cn(
                  'text-center text-xs font-semibold tabular-nums',
                  isActiveVisual || isFinishedVisual
                    ? goalMetricInkClass(visual)
                    : 'text-muted-foreground',
                )}
              >
                {progressPct}%
              </p>
            </div>
          </div>

          <div className="mt-auto border-t border-border/40 pt-2.5">
            <div className="flex items-center gap-1">
              {primaryAction ? (
                <PrimaryGoalAction
                  label={primaryAction.label}
                  onClick={primaryAction.onClick}
                  Icon={primaryAction.Icon}
                  strokeWidth={primaryAction.key === 'save' ? 2.5 : 2.25}
                  visual={visual}
                  isFinishedVisual={isFinishedVisual}
                />
              ) : (
                <div className="min-w-0 flex-1" />
              )}

              <Button
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  'h-9 shrink-0 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground',
                  WALLET_BRAND_HIT_BUTTON_CLASS,
                )}
              >
                <Link href={detailHref}>Detalles</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn('h-9 w-9 shrink-0', WALLET_BRAND_HIT_BUTTON_CLASS)}
                    aria-label={`Más opciones para ${wallet.name}`}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {canSaveAndArchive && canTransfer ? (
                    <DropdownMenuItem
                      onClick={() => onTransfer(wallet)}
                      className="cursor-pointer"
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      Transferir
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => onEdit(wallet)}
                    className="cursor-pointer"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  {canSaveAndArchive ? (
                    <DropdownMenuItem
                      onClick={() => onComplete(wallet)}
                      className="cursor-pointer"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Archivar
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(wallet)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    </article>
  );
};
