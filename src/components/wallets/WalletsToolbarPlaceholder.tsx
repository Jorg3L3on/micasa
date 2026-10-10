'use client';

import { useMemo } from 'react';
import { LineChart, Plus } from 'lucide-react';
import { PAGE_CREATE_ACTION } from '@/lib/ui/page-create-action';
import { useRegisterToolbarActions } from '@/context/toolbar-actions-context';

const noop = () => {};

/**
 * Registers the Billeteras toolbar actions (inert) while the route loads, so
 * the header cluster has the same width before and after data arrives and the
 * centered page title does not shift. The page replaces this on mount.
 */
export const WalletsToolbarPlaceholder = () => {
  const primaryActionIcon = useMemo(
    () => <Plus data-icon="inline-start" />,
    [],
  );
  const leadingActionIcon = useMemo(
    () => <LineChart data-icon="inline-start" />,
    [],
  );

  useRegisterToolbarActions({
    search: { value: '', onChange: noop, placeholder: 'Buscar por nombre' },
    filters: { open: false, onOpenChange: noop, activeCount: 0 },
    primaryAction: {
      label: PAGE_CREATE_ACTION.wallet.label,
      onClick: noop,
      icon: primaryActionIcon,
    },
    leadingAction: {
      label: 'Proyección de liquidez',
      href: '/wallets/liquidity',
      icon: leadingActionIcon,
    },
  });

  return null;
};
