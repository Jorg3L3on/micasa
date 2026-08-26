'use client';

import { useSyncExternalStore } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import {
  getCachedWalletCardVtSnapshot,
  WALLET_LIST_CARD_SHELL_CLASS,
  type WalletCardVtSnapshot,
} from '@/lib/ui/wallet-card-view-transition';

type WalletCardVtPlaceholderProps = {
  walletId: number;
  /** Kept for call-site compatibility; funding and credit share detail width. */
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
        'relative mx-auto w-full max-w-md lg:max-w-lg',
        className,
      )}
      data-wallet-vt={`wallet-card-${walletId}`}
      role="status"
      aria-label="Cargando billetera"
    >
      {snapshot ? (
        <StashedCardFace snapshot={snapshot} />
      ) : (
        <div
          className={cn(
            'w-full animate-pulse rounded-[1.375rem] border border-border/60 bg-muted/40',
            'min-h-[12rem] sm:min-h-[13.5rem]',
          )}
        />
      )}
    </div>
  );
}

function StashedCardFace({ snapshot }: { snapshot: WalletCardVtSnapshot }) {
  if (snapshot.isCredit) {
    return (
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[1.375rem] border border-white/15 text-white shadow-xl ring-1 ring-inset ring-white/10',
          WALLET_LIST_CARD_SHELL_CLASS,
        )}
        style={snapshot.style}
      >
        <div className="relative flex min-h-[12rem] flex-col justify-between gap-4 sm:min-h-[13.5rem]">
          <div className="flex items-start justify-between gap-2">
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
                  {snapshot.cycleLabel ?? snapshot.typeLabel}
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] tracking-[0.2em] opacity-50">
              •••• ••••
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Deuda actual
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums leading-snug tracking-tight sm:text-4xl">
                {formatCurrency(snapshot.amount)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs opacity-90">
              <div>
                <p className="text-[9px] uppercase tracking-wider opacity-70">
                  Disponible
                </p>
                <p className="font-mono text-sm font-semibold tabular-nums leading-snug">
                  {snapshot.availableCredit == null
                    ? 'Sin línea'
                    : formatCurrency(snapshot.availableCredit)}
                </p>
              </div>
              {snapshot.creditLimit != null && snapshot.creditLimit > 0 ? (
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider opacity-70">
                    Límite
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums leading-snug">
                    {formatCurrency(snapshot.creditLimit)}
                  </p>
                </div>
              ) : null}
            </div>

            {snapshot.utilizationPct != null &&
            snapshot.creditLimit != null &&
            snapshot.creditLimit > 0 ? (
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] opacity-70">
                  <span>Utilización</span>
                  <span className="font-mono tabular-nums">
                    {snapshot.utilizationPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/85"
                    style={{
                      width: `${Math.min(snapshot.utilizationPct, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-[1.375rem] border border-white/15 text-white shadow-xl ring-1 ring-inset ring-white/10',
        WALLET_LIST_CARD_SHELL_CLASS,
      )}
      style={snapshot.style}
    >
      <div className="relative flex min-h-[12rem] flex-col justify-between gap-4 sm:min-h-[13.5rem]">
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

        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              Saldo disponible
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums leading-snug tracking-tight sm:text-4xl">
              {formatCurrency(snapshot.amount)}
            </p>
          </div>

          <div
            className="invisible grid grid-cols-2 gap-3 text-xs"
            aria-hidden
          >
            <div>
              <p className="text-[9px] uppercase tracking-wider">Disponible</p>
              <p className="font-mono text-sm font-semibold tabular-nums leading-snug">
                $0.00
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider">Límite</p>
              <p className="font-mono text-sm font-semibold tabular-nums leading-snug">
                $0.00
              </p>
            </div>
          </div>

          <div className="invisible space-y-1" aria-hidden>
            <div className="flex justify-between text-[9px]">
              <span>Utilización</span>
              <span className="font-mono tabular-nums">0%</span>
            </div>
            <div className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
