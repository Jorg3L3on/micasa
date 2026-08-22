'use client';

import { LiquidityProjectionTab } from '@/components/wallets/liquidity/LiquidityProjectionTab';
import { LiquidityWelcome } from '@/components/wallets/liquidity/LiquidityWelcome';

export default function LiquidityPage() {
  return (
    <div className="space-y-8 pb-2">
      <LiquidityWelcome />
      <LiquidityProjectionTab />
    </div>
  );
}
