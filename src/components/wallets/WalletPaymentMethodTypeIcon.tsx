'use client';

import {
  Banknote,
  CreditCard,
  Landmark,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import type { PaymentMethodType } from '@/domain/payment-method';
import { cn } from '@/lib/utils';

type WalletPaymentMethodTypeIconProps = {
  type: string;
  className?: string;
  onGradient?: boolean;
};

const TYPE_ICON: Record<PaymentMethodType, LucideIcon> = {
  CASH: Banknote,
  DEBIT_CARD: Landmark,
  CREDIT_CARD: CreditCard,
  DEPARTMENT_STORE_CARD: ShoppingBag,
};

export const WalletPaymentMethodTypeIcon = ({
  type,
  className,
  onGradient = false,
}: WalletPaymentMethodTypeIconProps) => {
  const Icon = TYPE_ICON[type as PaymentMethodType] ?? Landmark;
  return (
    <Icon
      className={cn(
        'h-4 w-4',
        onGradient ? 'text-white/75' : 'text-muted-foreground',
        className,
      )}
      aria-hidden
    />
  );
};
