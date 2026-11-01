'use client';

import { useMemo } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { ArrowUpRight, BookmarkIcon } from 'lucide-react';
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
  /** Horizontal drift (px) of the face art inside the frame. */
  drift?: MotionValue<number>;
  /** Small arrow in the corner: the face opens the wallet detail. */
  showOpenHint?: boolean;
};

/** Card art used by the Billeteras cover flow: provider surface, icon, name, amount. */
export const WalletFlowFace = ({ wallet, className, drift, showOpenHint = false }: WalletFlowFaceProps) => {
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
        'relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-face border border-white/15 p-5 text-white shadow-face',
        hasAlert && 'ring-2 ring-inset ring-status-overdue/70',
        !wallet.active && 'opacity-80',
        className,
      )}
      style={style}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-[18%] inset-y-0 opacity-35 [background-image:radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.32),transparent_55%),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:auto,22px_22px,22px_22px]"
        style={{ x: drift }}
      />
      <div className="relative flex items-start justify-between gap-2">
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
      <div className="relative">
        <p className="eyebrow opacity-70">
          {isCard ? 'Deuda total' : 'Saldo disponible'}
        </p>
        <p className="font-sans text-3xl font-bold tabular-nums leading-snug tracking-tight sm:text-4xl">
          {formatCurrency(amount)}
        </p>
      </div>
      {showOpenHint ? (
        <span
          aria-hidden
          className="absolute bottom-4 right-4 flex size-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20"
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
};
