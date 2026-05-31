'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type CreditCardCycleTab,
  isCreditCardCycleTab,
} from '@/lib/finance/credit-card-cycle-types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type UseCreditCardCycleUrlStateOptions = {
  defaultAsOf: string;
  defaultTab?: CreditCardCycleTab;
};

export const useCreditCardCycleUrlState = ({
  defaultAsOf,
  defaultTab = 'movimientos',
}: UseCreditCardCycleUrlStateOptions) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const asOf = useMemo(() => {
    const raw = searchParams.get('asOf');
    return raw && ISO_DATE.test(raw) ? raw : defaultAsOf;
  }, [defaultAsOf, searchParams]);

  const tab = useMemo((): CreditCardCycleTab => {
    const raw = searchParams.get('tab');
    return raw && isCreditCardCycleTab(raw) ? raw : defaultTab;
  }, [defaultTab, searchParams]);

  const replaceParams = useCallback(
    (patch: { asOf?: string; tab?: CreditCardCycleTab }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (patch.asOf !== undefined) {
        if (patch.asOf === defaultAsOf) {
          next.delete('asOf');
        } else {
          next.set('asOf', patch.asOf);
        }
      }
      if (patch.tab !== undefined) {
        if (patch.tab === defaultTab) {
          next.delete('tab');
        } else {
          next.set('tab', patch.tab);
        }
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [defaultAsOf, defaultTab, pathname, router, searchParams],
  );

  const setAsOf = useCallback(
    (value: string) => replaceParams({ asOf: value }),
    [replaceParams],
  );

  const setTab = useCallback(
    (value: CreditCardCycleTab) => replaceParams({ tab: value }),
    [replaceParams],
  );

  return { asOf, tab, setAsOf, setTab };
};
