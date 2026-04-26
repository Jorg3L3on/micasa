'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { FinanceContextType } from '@/types/finance-context';

const STORAGE_KEY = 'finance_context';

type StoredFinance = {
  context: FinanceContextType;
  userId: number;
};

type FinanceContextValue = {
  context: FinanceContextType;
  setUserContext: (userId: number) => void;
  setHouseContext: (houseId: number) => void;
};

function persist(context: FinanceContextType, userId: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ context, userId } satisfies StoredFinance),
  );
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const DEFAULT_CONTEXT: FinanceContextType = { type: 'user', id: 0 };

/**
 * Inner component that uses useSearchParams. Must be inside Suspense so static
 * prerender (e.g. 404) does not trigger useSearchParams() without a boundary.
 */
function FinanceProviderSync({
  setContext,
  currentUserIdRef,
  hasSyncedUrlRef,
}: {
  setContext: React.Dispatch<React.SetStateAction<FinanceContextType>>;
  currentUserIdRef: React.MutableRefObject<number | null>;
  hasSyncedUrlRef: React.MutableRefObject<boolean>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // useLayoutEffect so owner context updates before sibling useEffect hooks run
  // (e.g. credit-card detail fetching with buildOwnerQuery).
  useLayoutEffect(() => {
    const userId =
      session?.user?.id != null ? Number(session.user.id) : null;
    const isUserIdValid = userId != null && !Number.isNaN(userId);
    if (!isUserIdValid) return;

    currentUserIdRef.current = userId;

    const ownerType = searchParams.get('ownerType');
    const ownerIdRaw = searchParams.get('ownerId');
    if (ownerType && ownerIdRaw != null && ownerIdRaw !== '') {
      const ownerId = Number(ownerIdRaw);
      if (
        (ownerType === 'user' || ownerType === 'house') &&
        !Number.isNaN(ownerId)
      ) {
        const urlContext: FinanceContextType = {
          type: ownerType,
          id: ownerId,
        };
        setContext(urlContext);
        persist(urlContext, userId);
        hasSyncedUrlRef.current = true;
        return;
      }
    }

    const userContext: FinanceContextType = { type: 'user', id: userId };
    setContext(userContext);
    persist(userContext, userId);
    if (!hasSyncedUrlRef.current) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('ownerType', 'user');
      params.set('ownerId', String(userId));
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`);
    }
    hasSyncedUrlRef.current = true;
  }, [session?.user?.id, searchParams, pathname, router, setContext, currentUserIdRef, hasSyncedUrlRef]);

  return null;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<FinanceContextType>(DEFAULT_CONTEXT);
  const currentUserIdRef = useRef<number | null>(null);
  const hasSyncedUrlRef = useRef(false);

  const setUserContext = useCallback((userId: number) => {
    const next: FinanceContextType = { type: 'user', id: userId };
    setContext(next);
    currentUserIdRef.current = userId;
    persist(next, userId);
  }, []);

  const setHouseContext = useCallback((houseId: number) => {
    const next: FinanceContextType = { type: 'house', id: houseId };
    setContext(next);
    const uid = currentUserIdRef.current;
    if (uid != null) persist(next, uid);
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      context,
      setUserContext,
      setHouseContext,
    }),
    [context, setUserContext, setHouseContext]
  );

  return (
    <FinanceContext.Provider value={value}>
      <Suspense fallback={null}>
        <FinanceProviderSync
          setContext={setContext}
          currentUserIdRef={currentUserIdRef}
          hasSyncedUrlRef={hasSyncedUrlRef}
        />
      </Suspense>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinanceContext(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (value == null) {
    throw new Error('useFinanceContext must be used within a FinanceProvider');
  }
  return value;
}
