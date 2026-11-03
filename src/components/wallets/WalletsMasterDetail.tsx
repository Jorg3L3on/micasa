'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WalletsMasterList } from '@/components/wallets/WalletsMasterList';
import { WalletDetailPane } from '@/components/wallets/WalletDetailPane';
import { walletDetailHref, walletMovementsHref } from '@/components/wallets/WalletFlowSection';
import type { WalletFlowActions } from '@/components/wallets/WalletFlowDetails';
import type { WalletAttentionItem, WalletTotals } from '@/lib/ui/wallet-cover-flow';
import {
  parseWalletSelection,
  resolveSelectedWalletId,
  WALLET_SELECTION_PARAM,
} from '@/lib/ui/wallet-master-detail';
import type { WalletListItem } from '@/types/catalog';

type WalletsMasterDetailProps = WalletFlowActions & {
  funding: WalletListItem[];
  credit: WalletListItem[];
  totals: WalletTotals;
  attention: WalletAttentionItem[];
  ownerQueryString: string;
  onCreate: () => void;
};

/** Web (`md`+) Billeteras layout: wallet list on the left, selected wallet on the right. */
export const WalletsMasterDetail = ({
  funding,
  credit,
  totals,
  attention,
  ownerQueryString,
  onCreate,
  ...actions
}: WalletsMasterDetailProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ordered = useMemo(() => [...funding, ...credit], [funding, credit]);
  const requested = parseWalletSelection(searchParams.get(WALLET_SELECTION_PARAM));
  const selectedId = resolveSelectedWalletId(ordered, requested);
  const selected = ordered.find((w) => w.id === selectedId) ?? null;

  const select = useCallback(
    (id: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(WALLET_SELECTION_PARAM, String(id));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="grid min-w-0 grid-cols-[280px_minmax(0,1fr)] items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="sticky top-4">
        <WalletsMasterList
          funding={funding}
          credit={credit}
          totals={totals}
          attention={attention}
          selectedId={selectedId}
          onSelect={select}
          onCreate={onCreate}
        />
      </div>
      {selected ? (
        <WalletDetailPane
          key={selected.id}
          wallet={selected}
          fullPageHref={walletDetailHref(selected, ownerQueryString)}
          movementsHref={walletMovementsHref(selected, ownerQueryString)}
          {...actions}
        />
      ) : null}
    </div>
  );
};
