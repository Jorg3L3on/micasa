'use client';

import { useState } from 'react';
import SegmentedControl from '@/components/ui/segmented-control';
import {
  availableWalletSegments,
  filterWalletsBySegment,
  type WalletTypeSegment,
} from '@/lib/ui/wallet-cover-flow';
import type { WalletListItem } from '@/types/catalog';
import {
  WalletFlowSection,
  type WalletFlowSectionProps,
} from '@/components/wallets/WalletFlowSection';

type WalletMobileFlowProps = Omit<
  WalletFlowSectionProps,
  'title' | 'hideHeader' | 'wallets'
> & {
  wallets: WalletListItem[];
};

/**
 * Mobile Billeteras: one cover flow for every wallet, with a type switcher
 * (Todas, Efectivo, Débito, Crédito, Tiendas) above it.
 */
export const WalletMobileFlow = ({
  wallets,
  focusWalletId,
  ...rest
}: WalletMobileFlowProps) => {
  const [segment, setSegment] = useState<WalletTypeSegment>('all');
  const segments = availableWalletSegments(wallets);
  // A filter can remove the last wallet of a type: fall back to everything.
  const current = segments.some((s) => s.value === segment) ? segment : 'all';
  const visible = filterWalletsBySegment(wallets, current);

  // Adjust during render: a wallet requested from the attention block may sit
  // in another type, so show everything to reach it.
  const [handledFocus, setHandledFocus] = useState<number | null>(null);
  if (focusWalletId != null && focusWalletId !== handledFocus) {
    setHandledFocus(focusWalletId);
    if (!visible.some((w) => w.id === focusWalletId)) setSegment('all');
  }

  return (
    <div className="space-y-2">
      {segments.length > 2 ? (
        <div className="flex justify-center">
          <SegmentedControl
            label="Tipo de billetera"
            value={current}
            onValueChange={(value) => setSegment(value as WalletTypeSegment)}
            options={segments.map(({ value, label }) => ({
              value,
              label,
              accessory: (
                <span className="text-caption tabular-nums text-muted-foreground">
                  {filterWalletsBySegment(wallets, value).length}
                </span>
              ),
            }))}
          />
        </div>
      ) : null}
      <WalletFlowSection
        {...rest}
        title="Billeteras"
        hideHeader
        wallets={visible}
        focusWalletId={focusWalletId}
      />
    </div>
  );
};
