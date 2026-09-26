import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { getCreditCardStatement } from '@/lib/api/credit-cards';
import { todayCalendarDate } from '@/lib/calendar-dates';
import type { FinanceContextType } from '@/types/finance-context';
import type {
  CreditCardListItem,
  CreditCardStatementResponse,
} from '@/types/catalog';
import type {
  WalletDetail,
  WalletMovementsResponse,
} from '@/types/wallet-movements';

type WarmEntry<T> = {
  promise: Promise<T>;
  value?: T;
  expiresAt: number;
};

const WARM_TTL_MS = 20_000;
const warmStore = new Map<string, WarmEntry<unknown>>();

const firstDayOfMonth = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

const lastDayOfMonth = (d: Date): string => {
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(last.getUTCDate()).padStart(2, '0')}`;
};

const ownerKey = (context?: FinanceContextType | null): string => {
  if (!context || context.id === 0) return 'session';
  return `${context.type}:${context.id}`;
};

const putWarm = <T,>(key: string, promise: Promise<T>): Promise<T> => {
  const existing = warmStore.get(key) as WarmEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.promise;
  }
  const entry: WarmEntry<T> = {
    promise,
    expiresAt: Date.now() + WARM_TTL_MS,
  };
  warmStore.set(key, entry as WarmEntry<unknown>);
  void promise.then(
    (value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + WARM_TTL_MS;
    },
    () => {
      warmStore.delete(key);
    },
  );
  return promise;
};

/** Resolve a warmed GET if still fresh; consumes the entry (one-shot). */
export const takeWarmed = async <T,>(key: string): Promise<T | null> => {
  const entry = warmStore.get(key) as WarmEntry<T> | undefined;
  if (!entry || entry.expiresAt <= Date.now()) {
    warmStore.delete(key);
    return null;
  }
  warmStore.delete(key);
  try {
    return entry.value ?? (await entry.promise);
  } catch {
    return null;
  }
};

export const walletDetailWarmKey = (
  walletId: number,
  context?: FinanceContextType | null,
): string => `wallet:${ownerKey(context)}:${walletId}`;

export const walletMovementsWarmKey = (
  walletId: number,
  from: string,
  to: string,
  context?: FinanceContextType | null,
): string => `movements:${ownerKey(context)}:${walletId}:${from}:${to}`;

export const creditCardWarmKey = (
  cardId: number,
  context?: FinanceContextType | null,
): string => `credit-card:${ownerKey(context)}:${cardId}`;

export const creditStatementWarmKey = (
  cardId: number,
  context?: FinanceContextType | null,
  asOf?: string,
): string =>
  `credit-statement:${ownerKey(context)}:${cardId}:${asOf ?? todayCalendarDate()}`;

/** Start detail API work on hover/focus so navigation paints the hero sooner. */
export const prefetchWalletDetailApis = (
  walletId: number,
  isCredit: boolean,
  context?: FinanceContextType | null,
): void => {
  if (!Number.isFinite(walletId) || walletId <= 0) return;
  if (typeof window === 'undefined') return;

  if (isCredit) {
    const asOf = todayCalendarDate();
    void putWarm(
      creditCardWarmKey(walletId, context),
      clientFetchFromApi<CreditCardListItem>(
        `/api/credit-cards/${walletId}`,
        undefined,
        context ?? undefined,
      ),
    );
    void putWarm(
      creditStatementWarmKey(walletId, context, asOf),
      getCreditCardStatement(walletId, context ?? undefined, asOf),
    );
    return;
  }

  const now = new Date();
  const from = firstDayOfMonth(now);
  const to = lastDayOfMonth(now);

  void putWarm(
    walletDetailWarmKey(walletId, context),
    clientFetchFromApi<WalletDetail>(
      `/api/wallets/${walletId}`,
      undefined,
      context ?? undefined,
    ),
  );
  void putWarm(
    walletMovementsWarmKey(walletId, from, to, context),
    clientFetchFromApi<WalletMovementsResponse>(
      `/api/wallets/${walletId}/movements?from=${from}&to=${to}`,
      undefined,
      context ?? undefined,
    ),
  );
};
