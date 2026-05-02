'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowDownAZ,
  ArrowDownZA,
  LineChart,
  ListFilter,
  WalletIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { WalletListCard } from '@/components/wallets/WalletListCard';
import { cn } from '@/lib/utils';

const CREDIT_TYPES: PaymentMethodType[] = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'];

const isCreditType = (type: string) =>
  CREDIT_TYPES.includes(type as PaymentMethodType);

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
  if (creditLineFilter === 'with_line') {
    return w.credit_limit != null;
  }
  if (creditLineFilter === 'no_line') {
    return w.credit_limit == null;
  }
  if (creditLineFilter === 'negative_available') {
    if (w.credit_limit == null) return false;
    return w.credit_limit - w.amount < 0;
  }
  return true;
};

const availableSortValue = (w: WalletListItem): number | null => {
  if (isCreditType(w.type)) {
    if (w.credit_limit == null) return null;
    return w.credit_limit - w.amount;
  }
  return w.amount;
};

const compareWallets = (
  a: WalletListItem,
  b: WalletListItem,
  sortKey: SortKey,
  sortDir: 'asc' | 'desc',
): number => {
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

  const displayWallets = useMemo(() => {
    const q = searchQuery;
    const filtered = wallets.filter((w) => {
      if (!walletMatchesSearch(w, q)) return false;
      if (!walletMatchesTypeFilter(w, typeFilter)) return false;
      if (!walletMatchesStatusFilter(w, statusFilter)) return false;
      if (!walletMatchesBalanceFilter(w, balanceFilter)) return false;
      if (!walletMatchesCreditLineFilter(w, creditLineFilter)) return false;
      return true;
    });
    return [...filtered].sort((a, b) =>
      compareWallets(a, b, sortKey, sortDir),
    );
  }, [
    wallets,
    searchQuery,
    typeFilter,
    statusFilter,
    balanceFilter,
    creditLineFilter,
    sortKey,
    sortDir,
  ]);

  /** Conteos para chips: aplica búsqueda y todos los filtros excepto la dimensión del chip. */
  const statusChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptStatus = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesTypeFilter(w, typeFilter) &&
      walletMatchesBalanceFilter(w, balanceFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter);

    const pool = wallets.filter(matchExceptStatus);
    return {
      all: pool.length,
      active: pool.filter((w) => w.active).length,
      inactive: pool.filter((w) => !w.active).length,
    };
  }, [
    wallets,
    searchQuery,
    typeFilter,
    balanceFilter,
    creditLineFilter,
  ]);

  const typeChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptType = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesStatusFilter(w, statusFilter) &&
      walletMatchesBalanceFilter(w, balanceFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter);

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
    statusFilter,
    balanceFilter,
    creditLineFilter,
  ]);

  const balanceChipCounts = useMemo(() => {
    const q = searchQuery;
    const matchExceptBalance = (w: WalletListItem) =>
      walletMatchesSearch(w, q) &&
      walletMatchesTypeFilter(w, typeFilter) &&
      walletMatchesStatusFilter(w, statusFilter) &&
      walletMatchesCreditLineFilter(w, creditLineFilter);

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
    typeFilter,
    statusFilter,
    creditLineFilter,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    typeFilter !== TYPE_FILTER_ALL ||
    statusFilter !== STATUS_FILTER_ALL ||
    balanceFilter !== BALANCE_FILTER_ALL ||
    creditLineFilter !== 'all';

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setTypeFilter(TYPE_FILTER_ALL);
    setStatusFilter(STATUS_FILTER_ALL);
    setBalanceFilter(BALANCE_FILTER_ALL);
    setCreditLineFilter('all');
  }, []);

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
        type: data.type,
        provider_icon_key: data.provider_icon_key ?? null,
        active: data.active || true,
        cutoff_day: data.cutoff_day || null,
        due_day: data.due_day || null,
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
        className="sticky top-20 z-20 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80"
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
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <Input
                    placeholder="Buscar por nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full max-w-full sm:max-w-xs"
                    aria-label="Buscar por nombre"
                  />
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
                    Estado
                  </p>
                  <div
                    className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
                    role="tablist"
                    aria-label="Filtrar por estado"
                  >
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
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </p>
                  <div
                    className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
                    role="tablist"
                    aria-label="Filtrar por tipo de billetera"
                  >
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
                          onClick={() => setTypeFilter(v)}
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
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Monto registrado
                    </p>
                    <div
                      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
                      role="tablist"
                      aria-label="Filtrar por monto en libros"
                    >
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
                    </div>
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
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        type="button"
        size="icon"
        aria-label="Agregar billetera o tarjeta"
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden"
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
              type: selectedWallet.type as PaymentMethodType,
              provider_icon_key: selectedWallet.provider_icon_key ?? null,
              active: selectedWallet.active,
              cutoff_day: selectedWallet.cutoff_day,
              due_day: selectedWallet.due_day,
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
