'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi, getFinanceOwnerKey, type ClientApiError } from '@/lib/api/client-fetch';
import { todayCalendarDate } from '@/lib/calendar-dates';
import type {
  PurchaseSimulationResult,
  SimulationWallet,
} from '@/lib/finance/purchase-simulation/purchase-simulation.service';
import type { PurchaseSimulationInput } from '@/schemas/purchase-simulation.schema';
import { PURCHASE_COPY } from '@/components/wallets/liquidity/purchase/copy';

export type PurchaseMode = 'contado' | 'msi' | 'credito';

/** What the form holds. Nothing here is persisted. */
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

export const DEBOUNCE_MS = 400;

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

const richestFunding = (wallets: SimulationWallet[]) =>
  [...wallets.filter((w) => !w.isCard)].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))[0] ?? null;

/** Fills wallets the person has not picked yet with sensible ones for the mode. */
export function resolveDraft(draft: PurchaseDraft, wallets: SimulationWallet[]): PurchaseDraft {
  const cards = wallets.filter((w) => w.isCard);
  const funding = wallets.filter((w) => !w.isCard);
  const out = { ...draft };
  const current = wallets.find((w) => w.id === out.walletId) ?? null;
  if (out.mode === 'msi' && (!current || !current.isCard)) out.walletId = cards[0]?.id ?? null;
  if (out.mode === 'contado' && !current) out.walletId = cards[0]?.id ?? funding[0]?.id ?? null;
  if (out.mode === 'credito') {
    if (typeof out.lender === 'number' && !cards.some((c) => c.id === out.lender)) out.lender = 'new';
    out.payWalletId = funding.some((w) => w.id === out.payWalletId) ? out.payWalletId : (funding[0]?.id ?? null);
    out.downWalletId = funding.some((w) => w.id === out.downWalletId) ? out.downWalletId : (richestFunding(wallets)?.id ?? null);
  }
  return out;
}

export function draftToBody(draft: PurchaseDraft): PurchaseSimulationInput | null {
  if (!(draft.total > 0)) return null;
  // Always until the quincena of the last payment: the server's default.
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

type State = {
  result: PurchaseSimulationResult | null;
  loading: boolean;
  error: string | null;
  fieldError: { field: string; message: string } | null;
};

export const usePurchaseSimulation = () => {
  const { context } = useFinanceContext();
  const ownerKey = context ? getFinanceOwnerKey(context) : '';
  const [wallets, setWallets] = useState<SimulationWallet[] | null>(null);
  const [walletsError, setWalletsError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PurchaseDraft>(() => emptyDraft());
  const [state, setState] = useState<State>({ result: null, loading: false, error: null, fieldError: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [seenOwnerKey, setSeenOwnerKey] = useState(ownerKey);
  const requestRef = useRef(0);

  // Switching user/house drops the simulation: each context has its own wallets.
  if (seenOwnerKey !== ownerKey) {
    setSeenOwnerKey(ownerKey);
    if (state.result || draft.total > 0) {
      setNotice(PURCHASE_COPY.clearedOnContextSwitch);
      setDraft(emptyDraft());
      setState({ result: null, loading: false, error: null, fieldError: null });
    }
  }

  useEffect(() => {
    let cancelled = false;
    setWallets(null);
    setWalletsError(null);
    clientFetchFromApi<{ wallets: SimulationWallet[] }>('/api/wallets/purchase-simulation', undefined, context)
      .then((res) => !cancelled && setWallets(res.wallets))
      .catch(() => !cancelled && setWalletsError(PURCHASE_COPY.errorBody));
    return () => {
      cancelled = true;
    };
  }, [context, ownerKey]);

  const resolved = useMemo(() => (wallets ? resolveDraft(draft, wallets) : draft), [draft, wallets]);
  const body = useMemo(() => draftToBody(resolved), [resolved]);
  const bodyKey = body ? JSON.stringify(body) : '';

  const run = useCallback(
    async (payload: PurchaseSimulationInput) => {
      const request = ++requestRef.current;
      setState((s) => ({ ...s, loading: true, error: null, fieldError: null }));
      try {
        const result = await clientFetchFromApi<PurchaseSimulationResult>(
          '/api/wallets/purchase-simulation',
          { method: 'POST', body: JSON.stringify(payload) },
          context,
        );
        if (request !== requestRef.current) return;
        setState({ result, loading: false, error: null, fieldError: null });
      } catch (error) {
        if (request !== requestRef.current) return;
        const apiError = error as ClientApiError;
        setState((s) => ({
          ...s,
          loading: false,
          error: apiError.status === 400 && apiError.field ? null : PURCHASE_COPY.errorBody,
          fieldError: apiError.status === 400 && apiError.field ? { field: apiError.field, message: apiError.message } : null,
        }));
      }
    },
    [context],
  );

  useEffect(() => {
    if (!body || !wallets) return;
    const timer = setTimeout(() => void run(body), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // bodyKey carries the body's content; run is stable per context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, wallets, run]);

  const retry = useCallback(() => {
    if (body) void run(body);
  }, [body, run]);

  const update = useCallback((patch: Partial<PurchaseDraft>) => setDraft((d) => ({ ...d, ...patch })), []);

  return {
    wallets,
    walletsError,
    draft: resolved,
    setDraft,
    update,
    hasBody: body != null,
    ...state,
    retry,
    notice,
    dismissNotice: () => setNotice(null),
    /** A finished result for the current inputs (not a previous one). */
    fresh: state.result != null && !state.loading,
  };
};

export type PurchaseSimulationController = ReturnType<typeof usePurchaseSimulation>;
