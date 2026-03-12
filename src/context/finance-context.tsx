'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
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

function parseStored(): StoredFinance | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'context' in parsed &&
      'userId' in parsed &&
      typeof (parsed as { userId: unknown }).userId === 'number'
    ) {
      const { context, userId } = parsed as {
        context: unknown;
        userId: number;
      };
      if (
        context &&
        typeof context === 'object' &&
        'type' in context &&
        'id' in context &&
        (context.type === 'user' || context.type === 'house') &&
        typeof (context as { id: unknown }).id === 'number'
      ) {
        return {
          context: context as FinanceContextType,
          userId,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function persist(context: FinanceContextType, userId: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ context, userId } satisfies StoredFinance),
  );
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const DEFAULT_CONTEXT: FinanceContextType = { type: 'user', id: 0 };

export function FinanceProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [context, setContext] = useState<FinanceContextType>(DEFAULT_CONTEXT);
  const currentUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    const userId =
      session?.user?.id != null ? Number(session.user.id) : null;
    const isUserIdValid = userId != null && !Number.isNaN(userId);
    currentUserIdRef.current = isUserIdValid ? userId : null;

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
        if (isUserIdValid) persist(urlContext, userId);
        return;
      }
    }

    const stored = parseStored();
    if (
      stored &&
      isUserIdValid &&
      stored.userId === userId
    ) {
      setContext(stored.context);
      return;
    }

    if (isUserIdValid) {
      const userContext: FinanceContextType = { type: 'user', id: userId };
      setContext(userContext);
      persist(userContext, userId);
    }
  }, [session?.user?.id, searchParams]);

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
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinanceContext(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (value == null) {
    throw new Error('useFinanceContext must be used within a FinanceProvider');
  }
  return value;
}
