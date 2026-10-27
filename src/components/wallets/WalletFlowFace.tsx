'use client';

import { useMemo } from 'react';
import { BookmarkIcon } from 'lucide-react';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
  isCreditOrStoreCardWalletType,
} from '@/domain/payment-method';
import {
  getProviderBrandColor,
  getProviderCardStyle,
  getWalletBrandCssVars,
} from '@/lib/provider-card-style';
import { effectiveCreditLimit } from '@/lib/ui/wallet-cover-flow';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import { Badge } from '@/components/ui/badge';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

type WalletFlowFaceProps = {
  wallet: WalletListItem;
  className?: string;
};

/** Card art used by the Billeteras cover flow: provider surface, icon, name, amount. */
export const WalletFlowFace = ({ wallet, className }: WalletFlowFaceProps) => {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const amount = Number(wallet.amount) || 0;
  const limit = isCard ? effectiveCreditLimit(wallet) : null;
  const hasAlert = isCard ? limit != null && limit > 0 && amount > limit : amount < 0;

  const style = useMemo(() => {
    const brand =
      getProviderBrandColor(wallet.provider_icon_key, wallet.type) ?? '#6366f1';
    return {
      ...getProviderCardStyle(wallet.provider_icon_key, wallet.type, 'wow'),
      ...getWalletBrandCssVars(brand),
    };
  }, [wallet.provider_icon_key, wallet.type]);

  return (
    <div
      className={cn(
        'relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-face border border-white/15 p-4 text-white shadow-face',
        hasAlert && 'ring-2 ring-inset ring-status-overdue/70',
        !wallet.active && 'opacity-80',
        className,
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <WalletProviderIcon
            providerIconKey={wallet.provider_icon_key}
            className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
            iconClassName="h-4 w-4"
            showTooltipLabel={false}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight opacity-95">
              {wallet.name}
            </p>
            <p className="eyebrow opacity-60">
              {PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType]}
            </p>
          </div>
        </div>
        {!wallet.active ? (
          <Badge
            variant="outline"
            className="h-6 shrink-0 gap-0.5 border-white/30 bg-black/20 px-1.5 text-caption text-white"
          >
            <BookmarkIcon className="h-2.5 w-2.5" aria-hidden />
            Inactivo
          </Badge>
        ) : isCard ? (
          <span className="font-mono text-caption tracking-[0.2em] opacity-50">
            •••• ••••
          </span>
        ) : null}
      </div>
      <div>
        <p className="eyebrow opacity-70">
          {isCard ? 'Deuda total' : 'Saldo disponible'}
        </p>
        <p className="font-sans text-2xl font-bold tabular-nums leading-snug tracking-tight sm:text-3xl">
          {formatCurrency(amount)}
        </p>
      </div>
    </div>
  );
};
