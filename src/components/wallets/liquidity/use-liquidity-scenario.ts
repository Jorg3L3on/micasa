'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { getFinanceOwnerKey, type ClientApiError } from '@/lib/api/client-fetch';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import type { LiquidityScenarioItem } from '@/schemas/liquidity-scenario.schema';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { SCENARIO_COPY } from '@/components/wallets/liquidity/scenario/copy';

export type ScenarioFormField = 'wallet_id' | 'amount' | 'date' | 'months';

export type ScenarioFieldErrors = Partial<Record<ScenarioFormField, string>>;

export type LiquidityScenarioState = {
  /** The item on screen, once the API answered for it. Never stored anywhere. */
  item: LiquidityScenarioItem | null;
  /** The projection computed with `item`. */
  data: LiquidityProjectionResponse | null;
  loading: boolean;
  /** Request failed for a reason no field owns (network, 500). */
  error: string | null;
  /** 400 the API pinned to one field. */
  fieldErrors: ScenarioFieldErrors;
  /** Shown once after the scenario was dropped by a context switch. */
  notice: string | null;
};

const toFormField = (field: string | undefined): ScenarioFormField | null => {
  if (field === 'wallet_id' || field === 'amount' || field === 'months') return field;
  if (field === 'date' || field === 'firstDate') return 'date';
  return null;
};

const EMPTY: LiquidityScenarioState = {
  item: null,
  data: null,
  loading: false,
  error: null,
  fieldErrors: {},
  notice: null,
};

/**
 * "¿Y si…?" state for the Análisis workspace. The scenario lives in memory only:
 * a reload clears it, and switching user/house drops it with a notice so two
 * contexts never mix.
 */
export const useLiquidityScenario = () => {
  const { context } = useFinanceContext();
  const [state, setState] = useState<LiquidityScenarioState>(EMPTY);
  const requestRef = useRef(0);
  const ownerKey = context ? getFinanceOwnerKey(context) : '';
  const ownerKeyRef = useRef(ownerKey);
  const [seenOwnerKey, setSeenOwnerKey] = useState(ownerKey);

  // Switching user/house drops the simulation: each context has its own projection.
  if (seenOwnerKey !== ownerKey) {
    setSeenOwnerKey(ownerKey);
    if (state.item || state.loading) {
      setState({ ...EMPTY, notice: SCENARIO_COPY.clearedOnContextSwitch });
    }
  }

  useEffect(() => {
    ownerKeyRef.current = ownerKey;
  }, [ownerKey]);

  const simulate = useCallback(
    async (item: LiquidityScenarioItem): Promise<boolean> => {
      const request = ++requestRef.current;
      const owner = ownerKeyRef.current;
      setState((current) => ({ ...current, loading: true, error: null, fieldErrors: {}, notice: null }));
      try {
        const data = await fetchLiquidityProjection(
          {
            omitZero: true,
            includeUnpaid: true,
            includeTemplates: true,
            scenario: [item],
          },
          context,
        );
        if (request !== requestRef.current || owner !== ownerKeyRef.current) return false;
        setState({ item, data, loading: false, error: null, fieldErrors: {}, notice: null });
        return true;
      } catch (error) {
        if (request !== requestRef.current || owner !== ownerKeyRef.current) return false;
        const apiError = error as ClientApiError;
        const field = apiError.status === 400 ? toFormField(apiError.field) : null;
        setState((current) => ({
          ...current,
          loading: false,
          error: field ? null : SCENARIO_COPY.errorBody,
          fieldErrors: field ? { [field]: apiError.message } : {},
        }));
        return false;
      }
    },
    [context],
  );

  const clear = useCallback(() => {
    requestRef.current += 1;
    setState(EMPTY);
  }, []);

  const dismissNotice = useCallback(() => {
    setState((current) => ({ ...current, notice: null }));
  }, []);

  /** Pull-to-refresh: recompute the scenario against fresh data. */
  const refresh = useCallback(async () => {
    if (state.item) await simulate(state.item);
  }, [simulate, state.item]);

  return { ...state, simulate, clear, dismissNotice, refresh };
};

export type LiquidityScenarioController = ReturnType<typeof useLiquidityScenario>;
