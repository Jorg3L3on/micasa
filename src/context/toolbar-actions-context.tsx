'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type ToolbarSearchConfig = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export type ToolbarFiltersConfig = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount?: number;
};

export type ToolbarPrimaryAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
};

/** Related-module nav in the leading cluster (e.g. Liquidez next to Sidebar). */
export type ToolbarLeadingAction = {
  label: string;
  href: string;
  icon?: ReactNode;
};

export type ToolbarOverflowItem = {
  key: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  destructive?: boolean;
};

export type ToolbarOverflowConfig = {
  items: ToolbarOverflowItem[];
};

export type ToolbarActionsRegistration = {
  search?: ToolbarSearchConfig | null;
  filters?: ToolbarFiltersConfig | null;
  primaryAction?: ToolbarPrimaryAction | null;
  overflow?: ToolbarOverflowConfig | null;
  leadingAction?: ToolbarLeadingAction | null;
};

type ToolbarActionsState = {
  search: ToolbarSearchConfig | null;
  filters: ToolbarFiltersConfig | null;
  primaryAction: ToolbarPrimaryAction | null;
  overflow: ToolbarOverflowConfig | null;
  leadingAction: ToolbarLeadingAction | null;
  searchMode: boolean;
  filtersMountNode: HTMLElement | null;
};

type ToolbarActionsDispatch = {
  setSearchMode: (open: boolean) => void;
  setFiltersMountNode: (node: HTMLElement | null) => void;
  register: (next: ToolbarActionsRegistration) => void;
  clear: () => void;
};

const ToolbarStateContext = createContext<ToolbarActionsState | null>(null);
const ToolbarDispatchContext = createContext<ToolbarActionsDispatch | null>(
  null,
);

const EMPTY_STATE: ToolbarActionsState = {
  search: null,
  filters: null,
  primaryAction: null,
  overflow: null,
  leadingAction: null,
  searchMode: false,
  filtersMountNode: null,
};

function sameSearch(
  a: ToolbarSearchConfig | null,
  b: ToolbarSearchConfig | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.value === b.value &&
    a.onChange === b.onChange &&
    a.placeholder === b.placeholder
  );
}

function sameFilters(
  a: ToolbarFiltersConfig | null,
  b: ToolbarFiltersConfig | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.open === b.open &&
    a.activeCount === b.activeCount &&
    a.onOpenChange === b.onOpenChange
  );
}

function samePrimary(
  a: ToolbarPrimaryAction | null,
  b: ToolbarPrimaryAction | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.label === b.label && a.onClick === b.onClick && a.icon === b.icon;
}

function sameLeading(
  a: ToolbarLeadingAction | null,
  b: ToolbarLeadingAction | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.label === b.label && a.href === b.href && a.icon === b.icon;
}

function sameOverflow(
  a: ToolbarOverflowConfig | null,
  b: ToolbarOverflowConfig | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.items.length !== b.items.length) return false;
  return a.items.every((item, index) => {
    const other = b.items[index];
    return (
      item.key === other.key &&
      item.label === other.label &&
      item.onClick === other.onClick &&
      item.icon === other.icon &&
      item.destructive === other.destructive
    );
  });
}

export function ToolbarActionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToolbarActionsState>(EMPTY_STATE);

  const setSearchMode = useCallback((open: boolean) => {
    setState((prev) =>
      prev.searchMode === open ? prev : { ...prev, searchMode: open },
    );
  }, []);

  const setFiltersMountNode = useCallback((node: HTMLElement | null) => {
    setState((prev) =>
      prev.filtersMountNode === node
        ? prev
        : { ...prev, filtersMountNode: node },
    );
  }, []);

  const register = useCallback((next: ToolbarActionsRegistration) => {
    const nextSearch = next.search ?? null;
    const nextFilters = next.filters ?? null;
    const nextPrimary = next.primaryAction ?? null;
    const nextLeading = next.leadingAction ?? null;
    const nextOverflow =
      next.overflow && next.overflow.items.length > 0 ? next.overflow : null;

    setState((prev) => {
      if (
        sameSearch(prev.search, nextSearch) &&
        sameFilters(prev.filters, nextFilters) &&
        samePrimary(prev.primaryAction, nextPrimary) &&
        sameLeading(prev.leadingAction, nextLeading) &&
        sameOverflow(prev.overflow, nextOverflow)
      ) {
        return prev;
      }
      return {
        ...prev,
        search: nextSearch,
        filters: nextFilters,
        primaryAction: nextPrimary,
        leadingAction: nextLeading,
        overflow: nextOverflow,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState((prev) => ({
      ...EMPTY_STATE,
      // Keep mount node if the shell still has the slot mounted.
      filtersMountNode: prev.filtersMountNode,
    }));
  }, []);

  const dispatch = useMemo<ToolbarActionsDispatch>(
    () => ({ setSearchMode, setFiltersMountNode, register, clear }),
    [setSearchMode, setFiltersMountNode, register, clear],
  );

  return (
    <ToolbarDispatchContext.Provider value={dispatch}>
      <ToolbarStateContext.Provider value={state}>
        {children}
      </ToolbarStateContext.Provider>
    </ToolbarDispatchContext.Provider>
  );
}

export function useToolbarActions(): ToolbarActionsState &
  ToolbarActionsDispatch {
  const state = useContext(ToolbarStateContext);
  const dispatch = useContext(ToolbarDispatchContext);
  if (!state || !dispatch) {
    throw new Error(
      'useToolbarActions must be used within a ToolbarActionsProvider',
    );
  }
  return { ...state, ...dispatch };
}

/**
 * Register page-owned toolbar actions for the current route; clears on unmount.
 * Uses the dispatch context only so registering does not loop with state updates.
 */
export function useRegisterToolbarActions(
  registration: ToolbarActionsRegistration,
) {
  const dispatch = useContext(ToolbarDispatchContext);
  if (!dispatch) {
    throw new Error(
      'useRegisterToolbarActions must be used within a ToolbarActionsProvider',
    );
  }

  const { register, clear } = dispatch;

  const searchValue = registration.search?.value;
  const searchOnChange = registration.search?.onChange;
  const searchPlaceholder = registration.search?.placeholder;
  const filtersOpen = registration.filters?.open;
  const filtersActiveCount = registration.filters?.activeCount;
  const filtersOnOpenChange = registration.filters?.onOpenChange;
  const primaryLabel = registration.primaryAction?.label;
  const primaryOnClick = registration.primaryAction?.onClick;
  const primaryIcon = registration.primaryAction?.icon;
  const leadingLabel = registration.leadingAction?.label;
  const leadingHref = registration.leadingAction?.href;
  const leadingIcon = registration.leadingAction?.icon;
  const overflowItems = registration.overflow?.items;
  const hasSearch = registration.search != null;
  const hasFilters = registration.filters != null;
  const hasPrimary = registration.primaryAction != null;
  const hasLeading = registration.leadingAction != null;
  const hasOverflow = Boolean(overflowItems && overflowItems.length > 0);

  useLayoutEffect(() => {
    register({
      search:
        hasSearch && searchOnChange
          ? {
              value: searchValue ?? '',
              onChange: searchOnChange,
              placeholder: searchPlaceholder,
            }
          : null,
      filters:
        hasFilters && filtersOnOpenChange
          ? {
              open: Boolean(filtersOpen),
              onOpenChange: filtersOnOpenChange,
              activeCount: filtersActiveCount,
            }
          : null,
      primaryAction:
        hasPrimary && primaryOnClick && primaryLabel
          ? {
              label: primaryLabel,
              onClick: primaryOnClick,
              icon: primaryIcon,
            }
          : null,
      leadingAction:
        hasLeading && leadingHref && leadingLabel
          ? {
              label: leadingLabel,
              href: leadingHref,
              icon: leadingIcon,
            }
          : null,
      overflow: hasOverflow && overflowItems ? { items: overflowItems } : null,
    });
  }, [
    register,
    hasSearch,
    hasFilters,
    hasPrimary,
    hasLeading,
    hasOverflow,
    searchValue,
    searchOnChange,
    searchPlaceholder,
    filtersOpen,
    filtersActiveCount,
    filtersOnOpenChange,
    primaryLabel,
    primaryOnClick,
    primaryIcon,
    leadingLabel,
    leadingHref,
    leadingIcon,
    overflowItems,
  ]);

  useLayoutEffect(() => {
    return () => clear();
  }, [clear]);
}

/** Renders filter UI into the open toolbar filters sheet/dropdown slot. */
export function ToolbarFiltersPortal({ children }: { children: ReactNode }) {
  const state = useContext(ToolbarStateContext);
  if (!state?.filters?.open || !state.filtersMountNode) return null;
  return createPortal(children, state.filtersMountNode);
}
