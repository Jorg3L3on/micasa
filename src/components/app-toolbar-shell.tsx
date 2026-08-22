'use client';

import { ToolbarActionsProvider } from '@/context/toolbar-actions-context';

/** Client boundary so the app layout can wrap shell chrome with toolbar actions. */
export function AppToolbarShell({ children }: { children: React.ReactNode }) {
  return <ToolbarActionsProvider>{children}</ToolbarActionsProvider>;
}
