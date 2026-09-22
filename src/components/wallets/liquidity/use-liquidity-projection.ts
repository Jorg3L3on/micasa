'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import type { LiquidityProjectionResponse } from '@/types/catalog';

export const useLiquidityProjection = () => {
  const { context } = useFinanceContext();
  const [data, setData] = useState<LiquidityProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');

  const reload = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLiquidityProjection(
        {
          chartRange: 'year_and_half',
          omitZero: true,
          includeUnpaid: true,
          includeTemplates: true,
        },
        context,
      );
      setData(res);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar tu panorama');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    loading,
    error,
    reload,
    selectedMonthKey,
    setSelectedMonthKey,
  };
};
