'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { updateWalletLiquidityInclusion } from '@/lib/api/wallets';
import type { WalletListItem } from '@/types/catalog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';

type LiquidityFundingWalletsMenuProps = {
  onChanged?: () => void;
};

const isFundingType = (type: string) =>
  type === 'CASH' || type === 'DEBIT_CARD';

export const LiquidityFundingWalletsMenu = ({
  onChanged,
}: LiquidityFundingWalletsMenuProps) => {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadWallets = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setWallets([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await clientFetchFromApi<WalletListItem[]>(
        '/api/wallets',
        undefined,
        context,
      );
      setWallets(
        list
          .filter((w) => w.active && isFundingType(w.type))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const handleToggle = async (wallet: WalletListItem, next: boolean) => {
    if (togglingId != null) return;
    const previous = wallets;
    setTogglingId(wallet.id);
    setWallets((prev) =>
      prev.map((w) =>
        w.id === wallet.id ? { ...w, include_in_liquidity: next } : w,
      ),
    );
    try {
      await updateWalletLiquidityInclusion(wallet.id, next, context);
      onChanged?.();
    } catch {
      setWallets(previous);
    } finally {
      setTogglingId(null);
    }
  };

  const includedCount = wallets.filter(
    (w) => w.include_in_liquidity !== false,
  ).length;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              aria-label="Elegir qué cuentas suman a tu dinero disponible"
              disabled={loading && wallets.length === 0}
            >
              <Settings2 className="size-3.5 shrink-0" aria-hidden />
              Elegir cuentas
              {wallets.length > 0 ? (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {includedCount}/{wallets.length}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Marca qué cuentas de efectivo y débito cuentan como dinero disponible
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Contar en mi dinero disponible</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {wallets.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No hay billeteras de efectivo o débito activas.
          </p>
        ) : (
          wallets.map((wallet) => (
            <DropdownMenuCheckboxItem
              key={wallet.id}
              checked={wallet.include_in_liquidity !== false}
              disabled={togglingId === wallet.id}
              onCheckedChange={(checked) => {
                void handleToggle(wallet, checked === true);
              }}
              onSelect={(event) => event.preventDefault()}
              className="gap-2"
            >
              <span className="min-w-0 flex-1 truncate">{wallet.name}</span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                {formatCurrency(Number(wallet.amount))}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
