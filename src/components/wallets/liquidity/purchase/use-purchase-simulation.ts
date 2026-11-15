'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi, getFinanceOwnerKey } from '@/lib/api/client-fetch';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  extendedBaselineUntil,
  preparePurchase,
  simulatePurchase,
  SimulationInputError,
  type PurchaseSimulationResult,
  type SimulationBaseline,
  type SimulationWallet,
} from '@/lib/finance/purchase-simulation/simulate';
import type { PurchaseSimulationInput } from '@/schemas/purchase-simulation.schema';
import { PURCHASE_COPY } from '@/components/wallets/liquidity/purchase/copy';

export type PurchaseMode = 'contado' | 'msi' | 'credito';

/** What the form holds. Kept only in this browser tab (sessionStorage), never sent to be stored. */
export type PurchaseDraft = {
  name: string;
  total: number;
  date: string;
  mode: PurchaseMode;
  walletId: number | null;
  months: number;
  /** 'new' = crédito nuevo; a number = that card with interest. */
  lender: 'new' | number;
  creditMonths: number;
  rate: number;
  knownPayment: number | null;
  /** null = 20% of the price. */
  down: number | null;
  downWalletId: number | null;
  payWalletId: number | null;
  extra: number;
};

export const emptyDraft = (today = todayCalendarDate()): PurchaseDraft => ({
  name: '',
  total: 0,
  date: today,
  mode: 'msi',
  walletId: null,
  months: 12,
  lender: 'new',
  creditMonths: 48,
  rate: 13.9,
  knownPayment: null,
  down: null,
  downWalletId: null,
  payWalletId: null,
  extra: 0,
});

const DRAFT_KEY = 'micasa.simular-compra.draft';

const readDraft = (ownerKey: string): PurchaseDraft => {
  const today = todayCalendarDate();
  try {
    const raw = window.sessionStorage.getItem(`${DRAFT_KEY}:${ownerKey}`);
    if (!raw) return emptyDraft(today);
    const saved = { ...emptyDraft(today), ...(JSON.parse(raw) as Partial<PurchaseDraft>) };
    return saved.date < today ? { ...saved, date: today } : saved;
  } catch {
    return emptyDraft(today);
  }
};

const writeDraft = (ownerKey: string, draft: PurchaseDraft) => {
  try {
    window.sessionStorage.setItem(`${DRAFT_KEY}:${ownerKey}`, JSON.stringify(draft));
  } catch {
    // Private mode or storage full: the form still works, it just is not kept.
  }
};

const richestFunding = (wallets: SimulationWallet[]) =>
  [...wallets.filter((w) => !w.isCard)].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))[0] ?? null;

/** The card with the most disponible (cards without a limit last). */
export const roomiestCard = (wallets: SimulationWallet[]) =>
  [...wallets.filter((w) => w.isCard)].sort((a, b) => (b.available ?? -Infinity) - (a.available ?? -Infinity))[0] ?? null;

/** Fills wallets the person has not picked yet with sensible ones for the mode. */
function resolveDraft(draft: PurchaseDraft, wallets: SimulationWallet[]): PurchaseDraft {
  const funding = wallets.filter((w) => !w.isCard);
  const out = { ...draft };
  const current = wallets.find((w) => w.id === out.walletId) ?? null;
  const card = roomiestCard(wallets);
  if (out.mode === 'msi' && (!current || !current.isCard)) out.walletId = card?.id ?? null;
  if (out.mode === 'contado' && !current) out.walletId = card?.id ?? funding[0]?.id ?? null;
  if (out.mode === 'credito') {
    if (typeof out.lender === 'number' && !wallets.some((c) => c.isCard && c.id === out.lender)) out.lender = 'new';
    out.payWalletId = funding.some((w) => w.id === out.payWalletId) ? out.payWalletId : (funding[0]?.id ?? null);
    out.downWalletId = funding.some((w) => w.id === out.downWalletId) ? out.downWalletId : (richestFunding(wallets)?.id ?? null);
  }
  return out;
}

function draftToBody(draft: PurchaseDraft): PurchaseSimulationInput | null {
  if (!(draft.total > 0)) return null;
  const base = { name: draft.name.trim() || undefined, total: draft.total, date: draft.date };
  if (draft.mode === 'contado') {
    return draft.walletId == null ? null : { ...base, mode: 'contado', wallet_id: draft.walletId };
  }
  if (draft.mode === 'msi') {
    return draft.walletId == null ? null : { ...base, mode: 'msi', wallet_id: draft.walletId, months: draft.months };
  }
  const rateOrPayment = draft.knownPayment != null && draft.knownPayment > 0
    ? { monthly_payment: draft.knownPayment }
    : { annual_rate: draft.rate };
  if (typeof draft.lender === 'number') {
    return { ...base, mode: 'credito', lender: 'card', wallet_id: draft.lender, months: draft.creditMonths, ...rateOrPayment };
  }
  if (draft.payWalletId == null) return null;
  const down = draft.down ?? Math.round(draft.total * 0.2);
  return {
    ...base,
    mode: 'credito',
    lender: 'new',
    months: draft.creditMonths,
    pay_wallet_id: draft.payWalletId,
    down_payment: down,
    down_wallet_id: down > 0 ? (draft.downWalletId ?? draft.payWalletId) : undefined,
    extra_monthly: draft.extra > 0 ? draft.extra : undefined,
    ...rateOrPayment,
  };
}

type Loaded = { wallets: SimulationWallet[]; baseline: SimulationBaseline };

type Computed =
  | { kind: 'result'; result: PurchaseSimulationResult }
  | { kind: 'field'; field: string; message: string }
  | { kind: 'extend'; until: string };

/**
 * Loads the wallets and the quincenas once, then simulates every change in the
 * browser. A plan that ends after the loaded quincenas loads more, once.
 */
export const usePurchaseSimulation = () => {
  const { context } = useFinanceContext();
  const ownerKey = context ? getFinanceOwnerKey(context) : '';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);
  const [draft, setDraft] = useState<PurchaseDraft>(() => (typeof window === 'undefined' ? emptyDraft() : readDraft(ownerKey)));
  const [notice, setNotice] = useState<string | null>(null);
  const [seenOwnerKey, setSeenOwnerKey] = useState(ownerKey);
  const [shown, setShown] = useState<PurchaseSimulationResult | null>(null);
  const requestRef = useRef(0);

  // Switching user/house drops the simulation: each context has its own wallets.
  if (seenOwnerKey !== ownerKey) {
    setSeenOwnerKey(ownerKey);
    if (shown || draft.total > 0) setNotice(PURCHASE_COPY.clearedOnContextSwitch);
    setDraft(readDraft(ownerKey));
    setShown(null);
  }

  const load = useCallback(
    async (until?: string) => {
      const request = ++requestRef.current;
      setLoadError(null);
      if (until) setExtending(true);
      try {
        const path = `/api/wallets/purchase-simulation${until ? `?until=${until}` : ''}`;
        const res = await clientFetchFromApi<Loaded>(path, undefined, context);
        if (request === requestRef.current) setLoaded(res);
      } catch {
        if (request === requestRef.current) setLoadError(PURCHASE_COPY.errorBody);
      } finally {
        if (request === requestRef.current) setExtending(false);
      }
    },
    [context],
  );

  useEffect(() => {
    setLoaded(null);
    void load();
  }, [load, ownerKey]);

  useEffect(() => {
    if (ownerKey) writeDraft(ownerKey, draft);
  }, [draft, ownerKey]);

  const wallets = loaded?.wallets ?? null;
  const resolved = useMemo(() => (wallets ? resolveDraft(draft, wallets) : draft), [draft, wallets]);
  const body = useMemo(() => draftToBody(resolved), [resolved]);

  const computed = useMemo<Computed | null>(() => {
    if (!loaded || !body) return null;
    try {
      const prepared = preparePurchase(body, loaded.wallets, loaded.baseline.as_of);
      if (prepared.until > loaded.baseline.until) return { kind: 'extend', until: extendedBaselineUntil(prepared.until) };
      return { kind: 'result', result: simulatePurchase(prepared, loaded.wallets, loaded.baseline) };
    } catch (error) {
      if (error instanceof SimulationInputError) return { kind: 'field', field: error.field, message: error.message };
      throw error;
    }
  }, [loaded, body]);

  // Keep the last good result on screen (dimmed) while a field is wrong or more quincenas load.
  if (computed?.kind === 'result' && computed.result !== shown) setShown(computed.result);

  const extendTo = computed?.kind === 'extend' ? computed.until : null;
  useEffect(() => {
    if (extendTo && !loadError) void load(extendTo);
  }, [extendTo, load, loadError]);

  const retry = useCallback(() => {
    void load(extendTo ?? loaded?.baseline.until);
  }, [extendTo, load, loaded]);

  const update = useCallback((patch: Partial<PurchaseDraft>) => setDraft((d) => ({ ...d, ...patch })), []);

  const loading = extending || (loaded == null && !loadError);
  return {
    wallets,
    /** Only when nothing loaded yet: the tab cannot show the form. */
    walletsError: loaded ? null : loadError,
    draft: resolved,
    setDraft,
    update,
    hasBody: body != null,
    result: body ? shown : null,
    loading,
    error: loaded && loadError ? loadError : null,
    fieldError: computed?.kind === 'field' ? { field: computed.field, message: computed.message } : null,
    retry,
    notice,
    dismissNotice: () => setNotice(null),
    /** The result on screen matches the form (not a previous one). */
    fresh: computed?.kind === 'result',
  };
};

export type PurchaseSimulationController = ReturnType<typeof usePurchaseSimulation>;
