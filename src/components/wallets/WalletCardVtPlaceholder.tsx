'use client';

import { useSyncExternalStore } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import {
  getCachedWalletCardVtSnapshot,
  type WalletCardVtSnapshot,
} from '@/lib/ui/wallet-card-view-transition';

type WalletCardVtPlaceholderProps = {
  walletId: number;
  /** Credit-card detail uses the wider aspect shell. */
  variant?: 'funding' | 'credit';
  className?: string;
};

/** Snapshot is sessionStorage-backed; nothing to subscribe to after first read. */
const subscribeVtSnapshot = () => () => {};

/**
 * Immediate detail-page stand-in for the list card during the view transition.
 * Same shared name is applied by the parent `<ViewTransition name={…}>`.
 *
 * Uses useSyncExternalStore so SSR / hydration always see `null` (pulse shell),
 * then the client paints the stashed face after hydrate — avoids mismatch when
 * sessionStorage has a snapshot from list → detail navigation.
 */
export function WalletCardVtPlaceholder({
  walletId,
  variant = 'funding',
  className,
}: WalletCardVtPlaceholderProps) {
  const snapshot = useSyncExternalStore(
    subscribeVtSnapshot,
    () => getCachedWalletCardVtSnapshot(walletId),
    () => null,
  );

  return (
    <div
      className={cn(
        'relative mx-auto w-full',
        variant === 'credit' ? 'max-w-md lg:max-w-lg' : 'max-w-sm',
        className,
      )}
      data-wallet-vt={`wallet-card-${walletId}`}
      role="status"
      aria-label="Cargando billetera"
    >
      {snapshot ? (
        <StashedCardFace snapshot={snapshot} variant={variant} />
      ) : (
        <div
          className={cn(
            'w-full animate-pulse rounded-2xl border border-border/60 bg-muted/40',
            variant === 'credit'
              ? 'aspect-[1.586/1]'
              : 'min-h-[10.75rem] sm:min-h-[12rem]',
          )}
        />
      )}
    </div>
  );
}

function StashedCardFace({
  snapshot,
  variant,
}: {
  snapshot: WalletCardVtSnapshot;
  variant: 'funding' | 'credit';
}) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-white/15 p-4 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-5',
        variant === 'credit'
          ? 'aspect-[1.586/1]'
          : 'min-h-[10.75rem] pb-5 sm:min-h-[12rem] sm:pb-6',
      )}
      style={snapshot.style}
    >
      <div className="relative flex h-full min-h-[inherit] flex-col justify-between gap-6">
        <div className="flex min-w-0 items-center gap-2">
          {snapshot.providerIconKey ? (
            <WalletProviderIcon
              providerIconKey={snapshot.providerIconKey}
              className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
              iconClassName="h-4 w-4"
              showTooltipLabel={false}
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-sm font-semibold">
              $
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight opacity-95">
              {snapshot.name}
            </p>
            <p className="text-[10px] uppercase tracking-widest opacity-60">
              {snapshot.typeLabel}
            </p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-55">
            {snapshot.isCredit ? 'Deuda' : 'Saldo disponible'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
            {formatCurrency(snapshot.amount)}
          </p>
        </div>
      </div>
    </div>
  );
}
