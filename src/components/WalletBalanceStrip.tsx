'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import type { WalletListItem } from '@/types/catalog';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import {
  isCreditOrStoreCardWalletType,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodType,
} from '@/domain/payment-method';
import { getWalletProviderOption } from '@/lib/wallet-provider-icons';
import { formatCurrency, cn } from '@/lib/utils';
import { CreditCard, Landmark, Wallet, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

type WalletBalanceStripProps = {
  wallets: WalletListItem[];
};

type StripTileProps = {
  wallet: WalletListItem;
  ownerQueryString: string;
};

const getTypeRank = (type: string) => {
  if (type === 'CASH') return 0;
  if (type === 'DEBIT_CARD') return 1;
  if (type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') return 2;
  return 3;
};

function WalletStripTile({
  wallet,
  ownerQueryString,
}: StripTileProps) {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const isFunding = wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
  const typeLabel = PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType];
  const providerLabel =
    getWalletProviderOption(wallet.provider_icon_key)?.label ?? typeLabel;
  const detailHref = useMemo(
    () =>
      isCard
        ? `/credit-cards/${wallet.id}${ownerQueryString}`
        : `/wallets/${wallet.id}${ownerQueryString}`,
    [isCard, wallet.id, ownerQueryString],
  );

  const creditLimit = Number(wallet.credit_limit ?? 0);
  const isNegativeBalance = isFunding && wallet.amount < 0;
  const isOverLimit =
    isCard && creditLimit > 0 && wallet.amount > creditLimit;
  const hasAlert = isNegativeBalance || isOverLimit;

  const fallbackAccent = isCard
    ? 'neutral'
    : wallet.type === 'DEBIT_CARD'
      ? 'blue'
      : wallet.type === 'CASH'
        ? 'emerald'
        : 'neutral';

  const WalletIcon =
    isCard
      ? CreditCard
      : wallet.type === 'DEBIT_CARD'
        ? Landmark
        : Wallet;

  const badgeClassName =
    wallet.type === 'CASH'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : wallet.type === 'DEBIT_CARD'
        ? 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300'
        : 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300';

  return (
    <Link
      href={detailHref}
      className={cn(
        'group mx-1 flex min-h-[62px] items-center gap-3 rounded-[15px] border-b border-border/60 bg-transparent px-3 py-2.5 text-left',
        'transition-colors duration-200 ease-out hover:bg-muted/35 active:bg-muted/50 motion-reduce:transition-none',
        'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        hasAlert && 'bg-rose-500/5',
      )}
      aria-label={`Ver detalles de ${wallet.name}, ${formatCurrency(wallet.amount)}`}
    >
      {wallet.provider_icon_key ? (
        <WalletProviderIcon
          providerIconKey={wallet.provider_icon_key}
          className="h-8 w-8 rounded-md border border-border/70 bg-background p-0.5 shadow-none"
          iconClassName="h-4 w-4"
          showTooltipLabel={false}
        />
      ) : (
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background',
            fallbackAccent === 'blue' && 'text-blue-600 dark:text-blue-400',
            fallbackAccent === 'emerald' &&
              'text-emerald-600 dark:text-emerald-400',
            fallbackAccent === 'neutral' && 'text-muted-foreground',
          )}
        >
          <WalletIcon className="h-4 w-4" aria-hidden />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight text-foreground">
          {wallet.name}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {providerLabel}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums text-foreground',
            hasAlert && 'text-destructive',
          )}
        >
          {formatCurrency(wallet.amount)}
        </span>
        <span
          className={cn(
            'inline-flex max-w-[9.5rem] items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-medium',
            badgeClassName,
          )}
        >
          {typeLabel}
        </span>
      </div>
    </Link>
  );
}

const WalletBalanceStrip = ({ wallets }: WalletBalanceStripProps) => {
  const { context } = useFinanceContext();
  const sectionId = useId().replace(/:/g, '');
  const headingId = `${sectionId}-heading`;
  const scrollHintId = `${sectionId}-scroll-hint`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({
    top: false,
    bottom: false,
  });
  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const sortedWallets = useMemo(() => {
    return [...wallets].sort((a, b) => {
      const rankDiff = getTypeRank(a.type) - getTypeRank(b.type);
      if (rankDiff !== 0) return rankDiff;

      const bothCreditTypes =
        isCreditOrStoreCardWalletType(a.type) &&
        isCreditOrStoreCardWalletType(b.type);

      if (bothCreditTypes) {
        const getUsedPct = (wallet: WalletListItem) => {
          const limit = Number(wallet.credit_limit ?? 0);
          if (limit <= 0) return Number.POSITIVE_INFINITY;
          return Math.max(0, Number(wallet.amount)) / limit;
        };

        const usedPctDiff = getUsedPct(a) - getUsedPct(b);
        if (usedPctDiff !== 0) return usedPctDiff;
      }

      return a.name.localeCompare(b.name);
    });
  }, [wallets]);

  const updateScrollEdges = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    setScrollEdges({
      top: viewport.scrollTop > 2,
      bottom: maxScrollTop - viewport.scrollTop > 2,
    });
  }, []);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    updateScrollEdges();
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [sortedWallets.length, updateScrollEdges]);

  if (wallets.length === 0) return null;

  return (
    <Card
      className="min-w-0 gap-0 overflow-hidden border-border/60 py-0"
      role="region"
      aria-labelledby={headingId}
      aria-describedby={scrollHintId}
    >
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
        <CardTitle className="truncate text-sm font-semibold text-foreground">
          <h2 id={headingId}>Billeteras</h2>
        </CardTitle>
        <Badge
          variant="secondary"
          className="h-7 gap-1.5 border border-border/60 bg-muted/50 px-2.5 text-muted-foreground shadow-none"
          aria-label={`${sortedWallets.length} ${
            sortedWallets.length === 1 ? 'billetera' : 'billeteras'
          }`}
        >
          <WalletCards className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {sortedWallets.length}
          </span>
          <span>{sortedWallets.length === 1 ? 'cuenta' : 'cuentas'}</span>
        </Badge>
      </CardHeader>
      <p id={scrollHintId} className="sr-only">
        Lista vertical desplazable. Usa la rueda, gestos táctiles o las teclas
        de dirección para recorrer las billeteras.
      </p>

      <CardContent className="px-2">
        <div className="relative">
          {scrollEdges.top ? (
            <div
              className="pointer-events-none absolute inset-x-px top-px z-20 h-6 rounded-t-lg bg-linear-to-b from-card to-transparent"
              aria-hidden
            />
          ) : null}
          {scrollEdges.bottom ? (
            <div
              className="pointer-events-none absolute inset-x-px bottom-px z-20 h-8 rounded-b-lg bg-linear-to-t from-card to-transparent"
              aria-hidden
            />
          ) : null}
          <div
            ref={scrollRef}
            className="max-h-[252px] space-y-1 overflow-y-auto overscroll-y-contain rounded-lg border border-border/60 [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="region"
            aria-label="Saldos de billeteras"
            tabIndex={0}
            onScroll={updateScrollEdges}
          >
            {sortedWallets.map((wallet) => (
              <WalletStripTile
                key={wallet.id}
                wallet={wallet}
                ownerQueryString={ownerQueryString}
              />
            ))}
          </div>
        </div>
      </CardContent>

    </Card>
  );
};

export default WalletBalanceStrip;
