'use client';

import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowDownAZ,
  ArrowDownZA,
  ChevronDown,
  LineChart,
  ListFilter,
  WalletIcon,
  X,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import WalletForm from '@/components/WalletForm';
import { WalletFormValues } from '@/schemas/wallet.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
} from '@/lib/api/client-fetch';
import { createCreditCard, updateCreditCard } from '@/lib/api/credit-cards';
import {
  createWallet,
  deleteWallet,
  updateWallet,
} from '@/lib/api/wallets';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHODS,
} from '@/domain/payment-method';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { WalletListItem } from '@/types/catalog';
import { WalletBalanceEditDialog } from '@/components/wallets/WalletBalanceEditDialog';
import { WalletListCard } from '@/components/wallets/WalletListCard';
import { cn } from '@/lib/utils';

const CREDIT_TYPES: PaymentMethodType[] = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

const isCreditType = (type: string) =>
  CREDIT_TYPES.includes(type as PaymentMethodType);

const getEffectiveCreditLimit = ({
  credit_limit,
  temporary_credit_limit,
}: {
  credit_limit: number | null | undefined;
  temporary_credit_limit: number | null | undefined;
}): number | null => {
  if (credit_limit == null && temporary_credit_limit == null) return null;
  if (credit_limit == null) return temporary_credit_limit ?? null;
  if (temporary_credit_limit == null) return credit_limit ?? null;
  return Math.max(credit_limit, temporary_credit_limit);
};

const TYPE_FILTER_ALL = 'all';
const STATUS_FILTER_ALL = 'all';
const BALANCE_FILTER_ALL = 'all';

type StatusFilterValue = typeof STATUS_FILTER_ALL | 'active' | 'inactive';
type BalanceFilterValue =
  | typeof BALANCE_FILTER_ALL
  | 'nonzero'
  | 'zero';

/** Solo aplica a tarjetas (crédito / departamental); el resto se excluye si no es «all». */
type CreditLineFilterValue =
  | 'all'
  | 'with_line'
  | 'no_line'
  | 'negative_available';

type SortKey = 'name' | 'amount' | 'available';

const ASSIGNEE_FILTER_ALL = 'all' as const;
type AssigneeFilterValue =
  | typeof ASSIGNEE_FILTER_ALL
  | 'unassigned'
  | number;

const STATUS_FILTER_CHIPS: { value: StatusFilterValue; label: string }[] = [
  { value: STATUS_FILTER_ALL, label: 'Todos' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
];

const TYPE_FILTER_CHIPS: { value: string; label: string }[] = [
  { value: TYPE_FILTER_ALL, label: 'Todos' },
  ...PAYMENT_METHOD_OPTIONS.map(({ value, label }) => ({ value, label })),
];

const BALANCE_FILTER_CHIPS: { value: BalanceFilterValue; label: string }[] = [
  { value: BALANCE_FILTER_ALL, label: 'Cualquier monto' },
  { value: 'nonzero', label: 'Con saldo o deuda' },
  { value: 'zero', label: 'En cero' },
];

const CREDIT_LINE_OPTIONS: { value: CreditLineFilterValue; label: string }[] =
  [
    { value: 'all', label: 'Cualquiera' },
    { value: 'with_line', label: 'Con línea asignada' },
    { value: 'no_line', label: 'Sin línea registrada' },
    { value: 'negative_available', label: 'Disponible negativo' },
  ];

/** Efectivo/débito vs tarjetas; al elegir un tipo concreto en chips, se vuelve a «all». */
type KindFilterValue = 'all' | 'funding' | 'credit';

const KIND_FILTER_CHIPS: { value: KindFilterValue; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'funding', label: 'Efectivo y débito' },
  { value: 'credit', label: 'Tarjetas' },
];

const FILTERS_STORAGE_KEY = 'micasa.wallets.listFilters';

const isStoredTypeFilter = (v: unknown): v is string =>
  v === TYPE_FILTER_ALL ||
  (typeof v === 'string' &&
    (PAYMENT_METHODS as readonly string[]).includes(v));

type StoredWalletListFilters = Partial<{
  typeFilter: string;
  statusFilter: StatusFilterValue;
  balanceFilter: BalanceFilterValue;
  creditLineFilter: CreditLineFilterValue;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  kindFilter: KindFilterValue;
  assigneeFilter: AssigneeFilterValue;
}>;

const parseStoredFilters = (): StoredWalletListFilters | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: StoredWalletListFilters = {};
    if (isStoredTypeFilter(o.typeFilter)) out.typeFilter = o.typeFilter;
    if (
      o.statusFilter === STATUS_FILTER_ALL ||
      o.statusFilter === 'active' ||
      o.statusFilter === 'inactive'
    ) {
      out.statusFilter = o.statusFilter;
    }
    if (
      o.balanceFilter === BALANCE_FILTER_ALL ||
      o.balanceFilter === 'nonzero' ||
      o.balanceFilter === 'zero'
    ) {
      out.balanceFilter = o.balanceFilter;
    }
    if (
      o.creditLineFilter === 'all' ||
      o.creditLineFilter === 'with_line' ||
      o.creditLineFilter === 'no_line' ||
      o.creditLineFilter === 'negative_available'
    ) {
      out.creditLineFilter = o.creditLineFilter;
    }
    if (o.sortKey === 'name' || o.sortKey === 'amount' || o.sortKey === 'available') {
      out.sortKey = o.sortKey;
    }
    if (o.sortDir === 'asc' || o.sortDir === 'desc') {
      out.sortDir = o.sortDir;
    }
    if (o.kindFilter === 'all' || o.kindFilter === 'funding' || o.kindFilter === 'credit') {
      out.kindFilter = o.kindFilter;
    }
    if (
      o.assigneeFilter === ASSIGNEE_FILTER_ALL ||
      o.assigneeFilter === 'unassigned' ||
      (typeof o.assigneeFilter === 'number' &&
        Number.isInteger(o.assigneeFilter) &&
        o.assigneeFilter > 0)
    ) {
      out.assigneeFilter = o.assigneeFilter as AssigneeFilterValue;
    }
    return out;
  } catch {
    return null;
  }
};

const ScrollFadeChipRow = ({
  ariaLabel,
  children,
  mode = 'tablist',
}: {
  ariaLabel: string;
  children: ReactNode;
  mode?: 'tablist' | 'group';
}) => (
  <div className="relative -mx-1">
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-background to-transparent"
      aria-hidden
    />
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-background to-transparent"
      aria-hidden
    />
    <div
      className="flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
      role={mode === 'tablist' ? 'tablist' : 'group'}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  </div>
);

const walletMatchesKindFilter = (
  w: WalletListItem,
  kindFilter: KindFilterValue,
): boolean => {
  if (kindFilter === 'all') return true;
  if (kindFilter === 'funding') {
    return w.type === 'CASH' || w.type === 'DEBIT_CARD';
  }
  return isCreditType(w.type);
};

const walletMatchesSearch = (w: WalletListItem, q: string): boolean => {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return w.name.toLowerCase().includes(t);
};

const walletMatchesTypeFilter = (
  w: WalletListItem,
  typeFilter: string,
): boolean => {
  if (typeFilter === TYPE_FILTER_ALL) return true;
  return w.type === typeFilter;
};

const walletMatchesStatusFilter = (
  w: WalletListItem,
  statusFilter: StatusFilterValue,
): boolean => {
  if (statusFilter === 'active' && !w.active) return false;
  if (statusFilter === 'inactive' && w.active) return false;
  return true;
};

const walletMatchesBalanceFilter = (
  w: WalletListItem,
  balanceFilter: BalanceFilterValue,
): boolean => {
  const amt = Number(w.amount);
  if (balanceFilter === 'nonzero' && !(amt > 0)) return false;
  if (balanceFilter === 'zero' && amt !== 0) return false;
  return true;
};

const walletMatchesCreditLineFilter = (
  w: WalletListItem,
  creditLineFilter: CreditLineFilterValue,
): boolean => {
  if (creditLineFilter === 'all') return true;
  if (!isCreditType(w.type)) return false;
  const cap = getEffectiveCreditLimit({
    credit_limit: w.credit_limit,
    temporary_credit_limit: w.temporary_credit_limit,
  });
  if (creditLineFilter === 'with_line') {
    return cap != null;
  }
  if (creditLineFilter === 'no_line') {
    return cap == null;
  }
  if (creditLineFilter === 'negative_available') {
    if (cap == null) return false;
    return cap - w.amount < 0;
  }
  return true;
};

const walletMatchesAssigneeFilter = (
  w: WalletListItem,
  assigneeFilter: AssigneeFilterValue,
  isHouseContext: boolean,
): boolean => {
  if (!isHouseContext || assigneeFilter === ASSIGNEE_FILTER_ALL) return true;
  if (assigneeFilter === 'unassigned') return w.assignee_user_id == null;
  return w.assignee_user_id === assigneeFilter;
};

const availableSortValue = (w: WalletListItem): number | null => {
  if (isCreditType(w.type)) {
    const cap = getEffectiveCreditLimit({
      credit_limit: w.credit_limit,
      temporary_credit_limit: w.temporary_credit_limit,
    });
    if (cap == null) return null;
    return cap - w.amount;
  }
  return w.amount;
};

/** Efectivo y débito antes que tarjetas; dentro de cada grupo aplica el criterio elegido. */
const compareFundingBeforeCredit = (
  a: WalletListItem,
  b: WalletListItem,
): number | null => {
  const ca = isCreditType(a.type);
  const cb = isCreditType(b.type);
  if (ca === cb) return null;
  return ca ? 1 : -1;
};

const compareWallets = (
  a: WalletListItem,
  b: WalletListItem,
  sortKey: SortKey,
  sortDir: 'asc' | 'desc',
): number => {
  const group = compareFundingBeforeCredit(a, b);
  if (group !== null) return group;

  const dir = sortDir === 'asc' ? 1 : -1;
  if (sortKey === 'name') {
    return dir * a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  }
  if (sortKey === 'amount') {
    return dir * (a.amount - b.amount);
  }
  const na = availableSortValue(a);
  const nb = availableSortValue(b);
  if (na === null && nb === null) return 0;
  if (na === null) return 1;
  if (nb === null) return -1;
  return dir * (na - nb);
};

export default function WalletsPage() {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletListItem | null>(
    null,
  );
  const [balanceWallet, setBalanceWallet] = useState<WalletListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [typeFilter, setTypeFilter] = useState<string>(TYPE_FILTER_ALL);
  const [statusFilter, setStatusFilter] =
    useState<StatusFilterValue>(STATUS_FILTER_ALL);
  const [balanceFilter, setBalanceFilter] =
    useState<BalanceFilterValue>(BALANCE_FILTER_ALL);
  const [creditLineFilter, setCreditLineFilter] =
    useState<CreditLineFilterValue>('all');
  const [kindFilter, setKindFilter] = useState<KindFilterValue>('all');
  const [assigneeFilter, setAssigneeFilter] =
    useState<AssigneeFilterValue>(ASSIGNEE_FILTER_ALL);
  const [houseMembers, setHouseMembers] = useState<
    { id: number; name: string }[]
  >([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isHouseContext = context?.type === 'house';

  const displayWallets = useMemo(() => {
    const q = searchQuery;
    const filtered = wallets.filter((w) => {
      if (!walletMatchesSearch(w, q)) return false;
      if (!walletMatchesKindFilter(w, kindFilter)) return false;
      if (!walletMatchesTypeFilter(w, typeFilter)) return false;
      if (!walletMatchesStatusFilter(w, statusFilter)) return false;
      if (!walletMatchesBalanceFilter(w, balanceFilter)) return false;
      if (!walletMatchesCreditLineFilter(w, creditLineFilter)) return false;
      if (!walletMatchesAssigneeFilter(w, assigneeFilter, isHouseContext)) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) =>
      compareWallets(a, b, sortKey, sortDir),
    );
  }, [
    wallets,
    searchQuery,
    kindFilter,
    typeFilter,
    statusFilter,
    balanceFilter,
    creditLineFilter,
    assigneeFilter,
    isHouseContext,
    sortKey,
    sortDir,
  ]);

  /** Conteos para chips: aplica búsqueda y todos los filtros excepto la dimensión del chip. */
  const statusChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptStatus = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesKindFilter(w, kindFilter) &&
      walletMatchesTypeFilter(w, typeFilter) &&
      walletMatchesBalanceFilter(w, balanceFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter) &&
      walletMatchesAssigneeFilter(w, assigneeFilter, isHouseContext);

    const pool = wallets.filter(matchExceptStatus);
    return {
      all: pool.length,
      active: pool.filter((w) => w.active).length,
      inactive: pool.filter((w) => !w.active).length,
    };
  }, [
    wallets,
    searchQuery,
    kindFilter,
    typeFilter,
    balanceFilter,
    creditLineFilter,
    assigneeFilter,
    isHouseContext,
  ]);

  const typeChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptType = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesKindFilter(w, kindFilter) &&
      walletMatchesStatusFilter(w, statusFilter) &&
      walletMatchesBalanceFilter(w, balanceFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter) &&
      walletMatchesAssigneeFilter(w, assigneeFilter, isHouseContext);

    const pool = wallets.filter(matchExceptType);
    const byType = (t: string) => pool.filter((w) => w.type === t).length;
    return {
      all: pool.length,
      CASH: byType('CASH'),
      DEBIT_CARD: byType('DEBIT_CARD'),
      CREDIT_CARD: byType('CREDIT_CARD'),
      DEPARTMENT_STORE_CARD: byType('DEPARTMENT_STORE_CARD'),
    };
  }, [
    wallets,
    searchQuery,
    kindFilter,
    statusFilter,
    balanceFilter,
    creditLineFilter,
    assigneeFilter,
    isHouseContext,
  ]);

  const balanceChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptBalance = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesKindFilter(w, kindFilter) &&
      walletMatchesTypeFilter(w, typeFilter) &&
      walletMatchesStatusFilter(w, statusFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter) &&
      walletMatchesAssigneeFilter(w, assigneeFilter, isHouseContext);

    const pool = wallets.filter(matchExceptBalance);
    const nonzero = pool.filter((w) => Number(w.amount) > 0).length;
    const zero = pool.filter((w) => Number(w.amount) === 0).length;
    return {
      all: pool.length,
      nonzero,
      zero,
    };
  }, [
    wallets,
    searchQuery,
    kindFilter,
    typeFilter,
    statusFilter,
    creditLineFilter,
    assigneeFilter,
    isHouseContext,
  ]);

  const kindChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptKind = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesTypeFilter(w, typeFilter) &&
      walletMatchesStatusFilter(w, statusFilter) &&
      walletMatchesBalanceFilter(w, balanceFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter) &&
      walletMatchesAssigneeFilter(w, assigneeFilter, isHouseContext);

    const pool = wallets.filter(matchExceptKind);
    return {
      all: pool.length,
      funding: pool.filter(
        (w) => w.type === 'CASH' || w.type === 'DEBIT_CARD',
      ).length,
      credit: pool.filter((w) => isCreditType(w.type)).length,
    };
  }, [
    wallets,
    searchQuery,
    typeFilter,
    statusFilter,
    balanceFilter,
    creditLineFilter,
    assigneeFilter,
    isHouseContext,
  ]);

  const assigneeChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptAssignee = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesKindFilter(w, kindFilter) &&
      walletMatchesTypeFilter(w, typeFilter) &&
      walletMatchesStatusFilter(w, statusFilter) &&
      walletMatchesBalanceFilter(w, balanceFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter);

    const pool = wallets.filter(matchExceptAssignee);
    const byMember: Record<number, number> = {};
    for (const m of houseMembers) {
      byMember[m.id] = pool.filter((w) => w.assignee_user_id === m.id).length;
    }
    return {
      all: pool.length,
      unassigned: pool.filter((w) => w.assignee_user_id == null).length,
      byMember,
    };
  }, [
    wallets,
    houseMembers,
    searchQuery,
    kindFilter,
    typeFilter,
    statusFilter,
    balanceFilter,
    creditLineFilter,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    kindFilter !== 'all' ||
    typeFilter !== TYPE_FILTER_ALL ||
    statusFilter !== STATUS_FILTER_ALL ||
    balanceFilter !== BALANCE_FILTER_ALL ||
    creditLineFilter !== 'all' ||
    (isHouseContext && assigneeFilter !== ASSIGNEE_FILTER_ALL);

  const listIsFiltered =
    hasActiveFilters || displayWallets.length !== wallets.length;

  const activeFilterDimensionCount = useMemo(() => {
    let n = 0;
    if (searchQuery.trim()) n += 1;
    if (kindFilter !== 'all') n += 1;
    if (typeFilter !== TYPE_FILTER_ALL) n += 1;
    if (statusFilter !== STATUS_FILTER_ALL) n += 1;
    if (balanceFilter !== BALANCE_FILTER_ALL) n += 1;
    if (creditLineFilter !== 'all') n += 1;
    if (isHouseContext && assigneeFilter !== ASSIGNEE_FILTER_ALL) n += 1;
    return n;
  }, [
    searchQuery,
    kindFilter,
    typeFilter,
    statusFilter,
    balanceFilter,
    creditLineFilter,
    isHouseContext,
    assigneeFilter,
  ]);

  const presetTarjetasConDeudaActive =
    kindFilter === 'credit' &&
    typeFilter === TYPE_FILTER_ALL &&
    statusFilter === 'active' &&
    balanceFilter === 'nonzero' &&
    creditLineFilter === 'all';

  const presetLiquidezEfectivoActive =
    kindFilter === 'funding' &&
    typeFilter === TYPE_FILTER_ALL &&
    statusFilter === 'active' &&
    balanceFilter === 'nonzero' &&
    creditLineFilter === 'all';

  const presetCupoNegativoActive =
    kindFilter === 'credit' &&
    typeFilter === TYPE_FILTER_ALL &&
    statusFilter === STATUS_FILTER_ALL &&
    balanceFilter === BALANCE_FILTER_ALL &&
    creditLineFilter === 'negative_available';

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setKindFilter('all');
    setTypeFilter(TYPE_FILTER_ALL);
    setStatusFilter(STATUS_FILTER_ALL);
    setBalanceFilter(BALANCE_FILTER_ALL);
    setCreditLineFilter('all');
    setAssigneeFilter(ASSIGNEE_FILTER_ALL);
  }, []);

  const handleTypeFilterChange = useCallback((v: string) => {
    setTypeFilter(v);
    if (v !== TYPE_FILTER_ALL) {
      setKindFilter('all');
    }
  }, []);

  const handleKindFilterChange = useCallback((v: KindFilterValue) => {
    setKindFilter(v);
    if (v !== 'all') {
      setTypeFilter(TYPE_FILTER_ALL);
    }
  }, []);

  const applyPresetTarjetasConDeuda = useCallback(() => {
    setKindFilter('credit');
    setTypeFilter(TYPE_FILTER_ALL);
    setStatusFilter('active');
    setBalanceFilter('nonzero');
    setCreditLineFilter('all');
  }, []);

  const applyPresetLiquidezEfectivo = useCallback(() => {
    setKindFilter('funding');
    setTypeFilter(TYPE_FILTER_ALL);
    setStatusFilter('active');
    setBalanceFilter('nonzero');
    setCreditLineFilter('all');
  }, []);

  const applyPresetCupoNegativo = useCallback(() => {
    setKindFilter('credit');
    setTypeFilter(TYPE_FILTER_ALL);
    setStatusFilter(STATUS_FILTER_ALL);
    setBalanceFilter(BALANCE_FILTER_ALL);
    setCreditLineFilter('negative_available');
  }, []);

  useLayoutEffect(() => {
    const s = parseStoredFilters();
    if (s) {
      if (s.typeFilter != null) setTypeFilter(s.typeFilter);
      if (s.statusFilter != null) setStatusFilter(s.statusFilter);
      if (s.balanceFilter != null) setBalanceFilter(s.balanceFilter);
      if (s.creditLineFilter != null) setCreditLineFilter(s.creditLineFilter);
      if (s.sortKey != null) setSortKey(s.sortKey);
      if (s.sortDir != null) setSortDir(s.sortDir);
      if (s.kindFilter != null) setKindFilter(s.kindFilter);
      if (s.assigneeFilter != null) setAssigneeFilter(s.assigneeFilter);
    }
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    try {
      const payload: StoredWalletListFilters = {
        typeFilter,
        statusFilter,
        balanceFilter,
        creditLineFilter,
        sortKey,
        sortDir,
        kindFilter,
        assigneeFilter,
      };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota / private mode */
    }
  }, [
    filtersReady,
    typeFilter,
    statusFilter,
    balanceFilter,
    creditLineFilter,
    sortKey,
    sortDir,
    kindFilter,
    assigneeFilter,
  ]);

  useEffect(() => {
    if (!isHouseContext) {
      setAssigneeFilter(ASSIGNEE_FILTER_ALL);
    }
  }, [isHouseContext]);

  useEffect(() => {
    if (context?.type !== 'house') {
      setHouseMembers([]);
      return;
    }
    let cancelled = false;
    void clientFetchFromApi<{ users: { id: number; name: string }[] }>(
      '/api/house-users',
      undefined,
      context,
    )
      .then((data) => {
        if (!cancelled) {
          setHouseMembers(
            data.users.map((u) => ({ id: u.id, name: u.name })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHouseMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [context]);

  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<WalletListItem[]>(
        '/api/wallets',
        undefined,
        context,
      );
      setWallets(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar las billeteras',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleCreate = async (data: WalletFormValues) => {
    try {
      setFormError(null);
      const payload = {
        name: data.name,
        amount: data.amount || 0,
        credit_limit: data.credit_limit ?? null,
        temporary_credit_limit: data.temporary_credit_limit ?? null,
        type: data.type,
        provider_icon_key: data.provider_icon_key ?? null,
        active: data.active || true,
        cutoff_day: data.cutoff_day || null,
        due_day: data.due_day || null,
        assignee_user_id: data.assignee_user_id ?? null,
      };

      if (isCreditType(data.type)) {
        await createCreditCard(payload, context);
        toast.success('Tarjeta creada');
      } else {
        await createWallet(payload, context);
        toast.success('Billetera creada');
      }
      await fetchWallets();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: WalletFormValues) => {
    if (!selectedWallet) return;
    try {
      setFormError(null);
      if (isCreditType(selectedWallet.type)) {
        await updateCreditCard(selectedWallet.id, data, context);
        toast.success('Tarjeta actualizada');
      } else {
        await updateWallet(selectedWallet.id, data, context);
        toast.success('Billetera actualizada');
      }
      await fetchWallets();
      setEditDialogOpen(false);
      setSelectedWallet(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedWallet) return;
    try {
      setError(null);
      await deleteWallet(selectedWallet.id, context);
      toast.success('Eliminada');
      await fetchWallets();
      setDeleteDialogOpen(false);
      setSelectedWallet(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict') ||
        message.includes('related')
      ) {
        setError('Está en uso y no puede eliminarse');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = useCallback((wallet: WalletListItem) => {
    setSelectedWallet(wallet);
    setEditDialogOpen(true);
    setFormError(null);
  }, []);

  const openDeleteDialog = useCallback((wallet: WalletListItem) => {
    setSelectedWallet(wallet);
    setDeleteDialogOpen(true);
    setError(null);
  }, []);

  const handleToggleSortDir = useCallback(() => {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }, []);

  return (
    <div className="space-y-4 pb-24">
      <div
        className="sticky top-16 z-40 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background px-4 py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
        aria-label="Acciones de billeteras"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Billeteras</h2>
          <p className="text-xs text-muted-foreground">
            Saldo, tarjetas y líneas disponibles en tu contexto actual.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 sm:hidden"
                asChild
              >
                <Link
                  href="/wallets/liquidity"
                  aria-label="Ver proyección de liquidez"
                >
                  <LineChart className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Proyección de liquidez
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <Link href="/wallets/liquidity" aria-label="Ver proyección de liquidez">
              <LineChart className="h-4 w-4" />
              Proyección de liquidez
            </Link>
          </Button>
          <Button
            type="button"
            className="hidden h-9 rounded-xl sm:inline-flex"
            onClick={() => setCreateDialogOpen(true)}
          >
            <WalletIcon className="h-4 w-4" />
            Agregar billetera o tarjeta
          </Button>
        </div>
      </div>

      <div className="relative z-0">
      {error && !deleteDialogOpen && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Cargando...
            </div>
          ) : wallets.length === 0 ? (
            <EmptyState message="No se encontraron billeteras" />
          ) : (
            <div className="space-y-4">
              <Collapsible
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                className="w-full"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-between gap-2 sm:max-w-md"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-left">
                        <ListFilter className="h-4 w-4 shrink-0" />
                        <span className="truncate font-medium">
                          Filtros, búsqueda y orden
                        </span>
                        {activeFilterDimensionCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="h-5 shrink-0 px-1.5 tabular-nums"
                          >
                            {activeFilterDimensionCount}
                          </Badge>
                        ) : null}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                          filtersOpen && 'rotate-180',
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  {!filtersOpen && hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 shrink-0 text-muted-foreground sm:self-center"
                      onClick={() => handleClearFilters()}
                      aria-label="Limpiar todos los filtros"
                    >
                      Limpiar
                    </Button>
                  ) : null}
                </div>
                <CollapsibleContent className="data-[state=open]:pt-4">
                  <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="relative w-full max-w-full sm:max-w-xs">
                    <Input
                      placeholder="Buscar por nombre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10"
                      aria-label="Buscar por nombre"
                    />
                    {searchQuery.trim() ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSearchQuery('')}
                        aria-label="Borrar búsqueda"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Select
                      value={sortKey}
                      onValueChange={(v) => setSortKey(v as SortKey)}
                    >
                      <SelectTrigger
                        className="w-full sm:w-[200px]"
                        aria-label="Ordenar por"
                      >
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Nombre</SelectItem>
                        <SelectItem value="amount">Saldo o deuda</SelectItem>
                        <SelectItem value="available">Disponible</SelectItem>
                      </SelectContent>
                    </Select>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={handleToggleSortDir}
                          aria-label={
                            sortDir === 'asc'
                              ? 'Orden ascendente; cambiar a descendente'
                              : 'Orden descendente; cambiar a ascendente'
                          }
                        >
                          {sortDir === 'asc' ? (
                            <ArrowDownAZ className="h-4 w-4" />
                          ) : (
                            <ArrowDownZA className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {sortDir === 'asc'
                          ? 'Ascendente (tocar para descendente)'
                          : 'Descendente (tocar para ascendente)'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Atajos
                  </p>
                  <ScrollFadeChipRow
                    mode="group"
                    ariaLabel="Atajos de filtro rápido"
                  >
                    <Button
                      type="button"
                      variant={
                        presetTarjetasConDeudaActive ? 'default' : 'outline'
                      }
                      size="sm"
                      className="h-8 shrink-0 rounded-full px-3 text-xs font-medium"
                      onClick={applyPresetTarjetasConDeuda}
                    >
                      <Zap className="mr-1 h-3.5 w-3.5 shrink-0" />
                      TC con deuda
                    </Button>
                    <Button
                      type="button"
                      variant={
                        presetLiquidezEfectivoActive ? 'default' : 'outline'
                      }
                      size="sm"
                      className="h-8 shrink-0 rounded-full px-3 text-xs font-medium"
                      onClick={applyPresetLiquidezEfectivo}
                    >
                      <Zap className="mr-1 h-3.5 w-3.5 shrink-0" />
                      Liquidez (efectivo)
                    </Button>
                    <Button
                      type="button"
                      variant={
                        presetCupoNegativoActive ? 'default' : 'outline'
                      }
                      size="sm"
                      className="h-8 shrink-0 rounded-full px-3 text-xs font-medium"
                      onClick={applyPresetCupoNegativo}
                    >
                      <Zap className="mr-1 h-3.5 w-3.5 shrink-0" />
                      Cupo en rojo
                    </Button>
                  </ScrollFadeChipRow>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Combinan varios filtros de una vez; no borran tu búsqueda por
                    nombre.
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ámbito
                  </p>
                  <ScrollFadeChipRow ariaLabel="Filtrar por efectivo o tarjetas">
                    {KIND_FILTER_CHIPS.map(({ value: v, label }) => {
                      const selected = kindFilter === v;
                      const count =
                        v === 'all'
                          ? kindChipCounts.all
                          : v === 'funding'
                            ? kindChipCounts.funding
                            : kindChipCounts.credit;
                      return (
                        <button
                          key={v}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => handleKindFilterChange(v)}
                          className={cn(
                            'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {label}{' '}
                          <span className="tabular-nums opacity-80">
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </ScrollFadeChipRow>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Si eliges un tipo concreto abajo, el ámbito vuelve a «Todas».
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Estado
                  </p>
                  <ScrollFadeChipRow ariaLabel="Filtrar por estado">
                    {STATUS_FILTER_CHIPS.map(({ value: v, label }) => {
                      const selected = statusFilter === v;
                      const count =
                        v === STATUS_FILTER_ALL
                          ? statusChipCounts.all
                          : v === 'active'
                            ? statusChipCounts.active
                            : statusChipCounts.inactive;
                      return (
                        <button
                          key={v}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setStatusFilter(v)}
                          className={cn(
                            'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {label}{' '}
                          <span className="tabular-nums opacity-80">
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </ScrollFadeChipRow>
                </div>

                {isHouseContext ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Asignado a
                    </p>
                    <ScrollFadeChipRow ariaLabel="Filtrar por asignación">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={assigneeFilter === ASSIGNEE_FILTER_ALL}
                        onClick={() => setAssigneeFilter(ASSIGNEE_FILTER_ALL)}
                        className={cn(
                          'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                          assigneeFilter === ASSIGNEE_FILTER_ALL
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Todas{' '}
                        <span className="tabular-nums opacity-80">
                          ({assigneeChipCounts.all})
                        </span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={assigneeFilter === 'unassigned'}
                        onClick={() => setAssigneeFilter('unassigned')}
                        className={cn(
                          'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                          assigneeFilter === 'unassigned'
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Sin asignar{' '}
                        <span className="tabular-nums opacity-80">
                          ({assigneeChipCounts.unassigned})
                        </span>
                      </button>
                      {houseMembers.map((m) => {
                        const selected = assigneeFilter === m.id;
                        const count = assigneeChipCounts.byMember[m.id] ?? 0;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setAssigneeFilter(m.id)}
                            className={cn(
                              'h-8 max-w-[200px] shrink-0 truncate rounded-full border px-3 text-xs font-medium transition-colors',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {m.name}{' '}
                            <span className="tabular-nums opacity-80">
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </ScrollFadeChipRow>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Solo en contexto casa: billeteras compartidas o asignadas a
                      un miembro.
                    </p>
                  </div>
                ) : null}

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </p>
                  <ScrollFadeChipRow ariaLabel="Filtrar por tipo de billetera">
                    {TYPE_FILTER_CHIPS.map(({ value: v, label }) => {
                      const selected = typeFilter === v;
                      const count =
                        v === TYPE_FILTER_ALL
                          ? typeChipCounts.all
                          : typeChipCounts[
                              v as keyof typeof typeChipCounts
                            ] ?? 0;
                      return (
                        <button
                          key={v}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => handleTypeFilterChange(v)}
                          className={cn(
                            'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {label}{' '}
                          <span className="tabular-nums opacity-80">
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </ScrollFadeChipRow>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Monto registrado
                    </p>
                    <ScrollFadeChipRow ariaLabel="Filtrar por monto en libros">
                      {BALANCE_FILTER_CHIPS.map(({ value: v, label }) => {
                        const selected = balanceFilter === v;
                        const count =
                          v === BALANCE_FILTER_ALL
                            ? balanceChipCounts.all
                            : v === 'nonzero'
                              ? balanceChipCounts.nonzero
                              : balanceChipCounts.zero;
                        return (
                          <button
                            key={v}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setBalanceFilter(v)}
                            className={cn(
                              'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {label}{' '}
                            <span className="tabular-nums opacity-80">
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </ScrollFadeChipRow>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-1.5"
                          aria-label="Filtros de línea de crédito para tarjetas"
                        >
                          <ListFilter className="h-4 w-4" />
                          <span className="hidden sm:inline">Tarjetas</span>
                          <span className="sm:hidden">TC</span>
                          {creditLineFilter !== 'all' ? (
                            <Badge
                              variant="secondary"
                              className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]"
                            >
                              1
                            </Badge>
                          ) : null}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                          Línea de crédito (solo tarjetas)
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={creditLineFilter}
                          onValueChange={(val) =>
                            setCreditLineFilter(val as CreditLineFilterValue)
                          }
                        >
                          {CREDIT_LINE_OPTIONS.map((opt) => (
                            <DropdownMenuRadioItem
                              key={opt.value}
                              value={opt.value}
                            >
                              {opt.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 shrink-0 text-muted-foreground"
                        onClick={handleClearFilters}
                        aria-label="Limpiar filtros de billeteras"
                      >
                        Limpiar filtros
                      </Button>
                    ) : null}
                  </div>
                </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm text-muted-foreground">
                  Mostrando{' '}
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {displayWallets.length}
                  </span>
                  {' '}
                  de{' '}
                  <span className="font-mono tabular-nums text-foreground">
                    {wallets.length}
                  </span>
                  {' '}
                  billeteras
                  {listIsFiltered ? (
                    <span className="text-xs"> · filtrado</span>
                  ) : null}
                </p>
              </div>

              {displayWallets.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  Ninguna billetera coincide con los filtros.
                </p>
              ) : (
                <ul
                  className="grid list-none gap-3 p-0 sm:gap-4 md:grid-cols-2 xl:grid-cols-3"
                  role="list"
                >
                  {displayWallets.map((wallet) => (
                    <li key={wallet.id}>
                      <WalletListCard
                        wallet={wallet}
                        ownerQueryString={ownerQueryString}
                        onEdit={openEditDialog}
                        onDelete={openDeleteDialog}
                        onOpenBalance={setBalanceWallet}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <Button
        type="button"
        size="icon"
        aria-label="Agregar billetera o tarjeta"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg sm:hidden"
        onClick={() => setCreateDialogOpen(true)}
      >
        <WalletIcon className="h-6 w-6" />
      </Button>

      <WalletForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          setFormError(null);
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
      />

      <WalletBalanceEditDialog
        wallet={balanceWallet}
        ownerQueryString={ownerQueryString}
        onOpenChange={(open) => {
          if (!open) setBalanceWallet(null);
        }}
        onSaved={(walletId, newAmount) => {
          setWallets((prev) =>
            prev.map((w) => (w.id === walletId ? { ...w, amount: newAmount } : w)),
          );
          setBalanceWallet((prev) =>
            prev && prev.id === walletId ? { ...prev, amount: newAmount } : prev,
          );
        }}
      />

      {selectedWallet && (
        <>
          <WalletForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setSelectedWallet(null);
                setFormError(null);
              }
            }}
            onSubmit={handleEdit}
            mode="edit"
            showAmountField={!isCreditType(selectedWallet.type)}
            defaultValues={{
              name: selectedWallet.name,
              amount: selectedWallet.amount ?? 0,
              credit_limit: selectedWallet.credit_limit ?? null,
              temporary_credit_limit: selectedWallet.temporary_credit_limit ?? null,
              type: selectedWallet.type as PaymentMethodType,
              provider_icon_key: selectedWallet.provider_icon_key ?? null,
              active: selectedWallet.active,
              cutoff_day: selectedWallet.cutoff_day,
              due_day: selectedWallet.due_day,
              assignee_user_id: selectedWallet.assignee_user_id ?? null,
            }}
            error={formError && editDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setSelectedWallet(null);
                setError(null);
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar billetera"
            description="¿Estás seguro de querer eliminar esta billetera? Esta acción no puede deshacerse."
            itemName={selectedWallet.name}
          />
        </>
      )}
    </div>
  );
}
