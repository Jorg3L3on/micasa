'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';

export type TransactionCatalogs = {
  expenseCategories: CategoryOption[];
  incomeCategories: CategoryOption[];
  wallets: PaymentMethodOption[];
};

const STALE_MS = 60_000;

type CacheEntry = {
  at: number;
  data?: TransactionCatalogs;
  pending?: Promise<TransactionCatalogs>;
};

/** One entry per owner context, shared by every form that needs the catalogs. */
const cache = new Map<string, CacheEntry>();

const ownerKey = (type: string, id: number) => `${type}-${id}`;

function load(
  key: string,
  context: Parameters<typeof getPaymentMethodOptions>[0],
  force: boolean,
): Promise<TransactionCatalogs> {
  const entry = cache.get(key);
  if (!force && entry?.data && Date.now() - entry.at < STALE_MS) {
    return Promise.resolve(entry.data);
  }
  if (entry?.pending) return entry.pending;

  const pending = Promise.all([
    clientFetchFromApi<CategoryOption[]>('/api/categories?kind=expense', undefined, context),
    clientFetchFromApi<CategoryOption[]>('/api/categories?kind=income', undefined, context),
    getPaymentMethodOptions(context),
  ]).then(([expenseCategories, incomeCategories, wallets]) => {
    const data = { expenseCategories, incomeCategories, wallets };
    cache.set(key, { at: Date.now(), data });
    return data;
  });
  cache.set(key, { at: entry?.at ?? 0, data: entry?.data, pending });
  pending.catch(() => {
    const current = cache.get(key);
    if (current?.pending === pending) {
      cache.set(key, { at: current.at, data: current.data });
    }
  });
  return pending;
}

/** Drop cached catalogs (call after creating or editing wallets or categories). */
export function invalidateTransactionCatalogs() {
  cache.clear();
}

/**
 * Categories (gasto, ingreso) and wallets for the active owner context. Served
 * from a short-lived cache, so opening several forms in a row does not refetch.
 * Cached data shows immediately while a stale copy refreshes in the background.
 */
export function useTransactionCatalogs(enabled = true) {
  const { context } = useFinanceContext();
  const key = ownerKey(context.type, context.id);
  const [fetched, setFetched] = useState<{
    key: string;
    data: TransactionCatalogs;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await load(key, context, true);
      setFetched({ key, data: next });
      setError(null);
    } catch (err) {
      console.error('Error fetching transaction catalogs:', err);
      setError('No se pudieron cargar categorías y billeteras');
    }
  }, [context, key]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    load(key, context, false)
      .then((next) => {
        if (cancelled) return;
        setFetched({ key, data: next });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error fetching transaction catalogs:', err);
        setError('No se pudieron cargar categorías y billeteras');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, context]);

  const data =
    fetched?.key === key ? fetched.data : (cache.get(key)?.data ?? null);

  return {
    expenseCategories: data?.expenseCategories ?? [],
    incomeCategories: data?.incomeCategories ?? [],
    wallets: data?.wallets ?? [],
    loading: enabled && data == null && error == null,
    error,
    refresh,
  };
}
