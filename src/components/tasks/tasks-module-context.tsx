'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type TasksModuleContextValue = {
  /** House: filter habit/task lists on Hoy for one member; null = todos los miembros */
  todayScopeUserId: number | null;
  setTodayScopeUserId: (id: number | null) => void;
};

const TasksModuleContext = createContext<TasksModuleContextValue | null>(null);

export function TasksModuleProvider({ children }: { children: ReactNode }) {
  const [todayScopeUserId, setTodayScopeUserId] = useState<number | null>(null);
  const value = useMemo(
    () => ({ todayScopeUserId, setTodayScopeUserId }),
    [todayScopeUserId],
  );
  return (
    <TasksModuleContext.Provider value={value}>{children}</TasksModuleContext.Provider>
  );
}

export function useTasksModuleScope(): TasksModuleContextValue {
  const ctx = useContext(TasksModuleContext);
  if (!ctx) {
    throw new Error('useTasksModuleScope must be used within TasksModuleProvider');
  }
  return ctx;
}
