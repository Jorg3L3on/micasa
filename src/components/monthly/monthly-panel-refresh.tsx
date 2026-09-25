'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

type PanelRefresh = () => Promise<void>;

const MonthlyPanelRefreshRegisterContext = createContext<
  (refresh: PanelRefresh | null) => void
>(() => {});

export const MonthlyPanelRefreshRegisterProvider = ({
  register,
  children,
}: {
  register: (refresh: PanelRefresh | null) => void;
  children: ReactNode;
}) => (
  <MonthlyPanelRefreshRegisterContext.Provider value={register}>
    {children}
  </MonthlyPanelRefreshRegisterContext.Provider>
);

/**
 * The open Panel financiero registers here so saves can refetch its data
 * instead of calling router.refresh(), which remounts the page.
 */
export const useRegisterMonthlyPanelRefresh = (
  refresh: PanelRefresh | null,
) => {
  const register = useContext(MonthlyPanelRefreshRegisterContext);
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;

    if (!refresh) {
      register(null);
      return;
    }

    const run = () => {
      const current = refreshRef.current;
      if (!current) return Promise.resolve();
      return current();
    };

    register(run);
    return () => register(null);
  }, [refresh, register]);
};
