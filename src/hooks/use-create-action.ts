'use client';

import { useMemo, type ReactNode } from 'react';
import { useOptionalQuickCapture } from '@/components/quick-capture/QuickCaptureHost';
import { useToolbarActions } from '@/context/toolbar-actions-context';
import { PAGE_CREATE_ACTION } from '@/lib/ui/page-create-action';

export type CreateAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
};

/**
 * Header "+": the page alta when one is registered, otherwise Agregar gasto o ingreso.
 */
export const useCreateAction = (): CreateAction | null => {
  const { primaryAction } = useToolbarActions();
  const quickCapture = useOptionalQuickCapture();
  const openQuickCapture = quickCapture?.open;

  return useMemo(() => {
    if (primaryAction) return primaryAction;
    if (!openQuickCapture) return null;
    return {
      label: PAGE_CREATE_ACTION.expenseOrIncome.label,
      onClick: openQuickCapture,
    };
  }, [primaryAction, openQuickCapture]);
};
