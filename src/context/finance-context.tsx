'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { FinanceContextType } from '@/types/finance-context';

const STORAGE_KEY = 'finance_context';

type FinanceContextValue = {
  context: FinanceContextType;
  setUserContext: (userId: number) => void;
  setHouseContext: (houseId: number) => void;
};

function parseStored(): FinanceContextType | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      'id' in parsed &&
      (parsed.type === 'user' || parsed.type === 'house') &&
      typeof (parsed as { id: unknown }).id === 'number'
    ) {
      return {
        type: parsed.type,
        id: (parsed as { id: number }).id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function persist(context: FinanceContextType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const DEFAULT_CONTEXT: FinanceContextType = { type: 'user', id: 0 };

export function FinanceProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [context, setContext] = useState<FinanceContextType>(DEFAULT_CONTEXT);

  useEffect(() => {
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
        persist(urlContext);
        return;
      }
    }

    const stored = parseStored();
    if (stored) {
      setContext(stored);
      return;
    }
    const userId = session?.user?.id != null ? Number(session.user.id) : null;
    if (userId != null && !Number.isNaN(userId)) {
      const userContext: FinanceContextType = { type: 'user', id: userId };
      setContext(userContext);
      persist(userContext);
    }
  }, [session?.user?.id, searchParams]);

  const setUserContext = useCallback((userId: number) => {
    const next: FinanceContextType = { type: 'user', id: userId };
    setContext(next);
    persist(next);
  }, []);

  const setHouseContext = useCallback((houseId: number) => {
    const next: FinanceContextType = { type: 'house', id: houseId };
    setContext(next);
    persist(next);
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
