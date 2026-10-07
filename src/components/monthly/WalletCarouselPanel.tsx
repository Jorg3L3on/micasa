'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  History,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import WalletForm from '@/components/WalletForm';
import AddTransactionDialog from '@/components/transactions/AddTransactionDialog';
import CreditCardPaymentDialog, {
  type CreditCardPaymentSubmitPayload,
} from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { Button } from '@/components/ui/button';
import { useFinanceContext } from '@/context/finance-context';
import { useProviderCardScheme } from '@/hooks/use-provider-card-scheme';
import {
  PAYMENT_METHOD_SHORT_LABELS,
  type PaymentMethodType,
} from '@/domain/payment-method';
import {
  createCreditCard,
  createCreditCardPayment,
} from '@/lib/api/credit-cards';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { createWalletIncome } from '@/lib/api/incomes';
import { createWallet } from '@/lib/api/wallets';
import {
  getProviderCardStyle,
  isProviderCardDarkSurface,
} from '@/lib/provider-card-style';
import {
  clampCarouselIndex,
  firstCarouselTypeWithWallets,
  getWalletCarouselActionPlan,
  getWalletCreditSummary,
  groupWalletsByCarouselType,
  isCreditCarouselType,
  parseWalletCarouselTab,
  resolveCarouselSwipe,
  WALLET_CAROUSEL_TAB_LABELS,
  WALLET_CAROUSEL_TYPES,
  walletCarouselTabStorageKey,
  type WalletCarouselQuickAction,
  type WalletCarouselType,
} from '@/lib/ui/wallet-carousel';
import { cn, formatCurrency } from '@/lib/utils';
import type { WalletFormValues } from '@/schemas/wallet.schema';
import type {
  AddExpenseFormValues,
  AddIncomeFormValues,
} from '@/schemas/transaction.schema';
import type { PaymentMethodOption, WalletListItem } from '@/types/catalog';

type WalletCarouselPanelProps = {
  wallets: WalletListItem[];
  /** Stable key for the active owner context (user vs house). */
  ownerKey: string;
  /** Refetch panel wallets + summaries after any mutation. */
  onRefresh: () => Promise<void> | void;
  className?: string;
};

type ActiveDialog = WalletCarouselQuickAction | 'create' | null;

const CARD_WIDTH_RATIO = 0.74;
const CARD_GAP_PX = 12;

const WalletFace = ({
  wallet,
  isActive,
}: {
  wallet: WalletListItem;
  isActive: boolean;
}) => {
  const scheme = useProviderCardScheme();
  const credit = isCreditCarouselType(wallet.type);
  const summary = credit ? getWalletCreditSummary(wallet) : null;
  const style = getProviderCardStyle(
    wallet.provider_icon_key,
    wallet.type,
    'subtle',
    scheme,
  );
  const dark = isProviderCardDarkSurface('subtle', scheme);

  return (
    <div
      className={cn(
        'relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-4',
        'border-white/10 bg-gradient-to-br from-white/10 via-transparent to-black/20 shadow-lg backdrop-blur',
        dark ? 'text-white' : 'text-foreground',
        !isActive && 'pointer-events-none',
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <WalletProviderIcon
            providerIconKey={wallet.provider_icon_key}
            showTooltipLabel={false}
          />
          <span className="truncate text-sm font-semibold">{wallet.name}</span>
        </div>
        <span className="shrink-0 text-xs opacity-70">
          {PAYMENT_METHOD_SHORT_LABELS[wallet.type as PaymentMethodType] ??
            wallet.type}
        </span>
      </div>

      <div>
        <p className="text-xs opacity-70">
          {credit ? 'Saldo utilizado' : 'Saldo'}
        </p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(wallet.amount)}
        </p>
        {summary?.limit != null ? (
          <p className="mt-0.5 text-xs opacity-70 tabular-nums">
            Disponible {formatCurrency(summary.available ?? 0)} de{' '}
            {formatCurrency(summary.limit)}
          </p>
        ) : null}
      </div>

      {credit && (wallet.cutoff_day != null || wallet.due_day != null) ? (
        <p className="text-xs opacity-70">
          {wallet.cutoff_day != null ? `Corte día ${wallet.cutoff_day}` : null}
          {wallet.cutoff_day != null && wallet.due_day != null ? ' · ' : null}
          {wallet.due_day != null ? `Vence día ${wallet.due_day}` : null}
        </p>
      ) : (
        <span aria-hidden className="h-4" />
      )}
    </div>
  );
};

export const WalletCarouselPanel = ({
  wallets,
  ownerKey,
  onRefresh,
  className,
}: WalletCarouselPanelProps) => {
  const { context } = useFinanceContext();
  const reduceMotion = useReducedMotion();
  const groups = useMemo(() => groupWalletsByCarouselType(wallets), [wallets]);

  const [tab, setTab] = useState<WalletCarouselType>(() =>
    firstCarouselTypeWithWallets(groups),
  );
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Restore the remembered tab once per owner context.
  useEffect(() => {
    let stored: WalletCarouselType | null = null;
    try {
      stored = parseWalletCarouselTab(
        window.localStorage.getItem(walletCarouselTabStorageKey(ownerKey)),
      );
    } catch {
      stored = null;
    }
    setTab(stored ?? firstCarouselTypeWithWallets(groups));
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on owner change
  }, [ownerKey]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const list = groups[tab];
  const activeIndex = clampCarouselIndex(index, list.length);
  const activeWallet: WalletListItem | undefined = list[activeIndex];

  const selectTab = useCallback(
    (next: WalletCarouselType) => {
      setTab(next);
      setIndex(0);
      try {
        window.localStorage.setItem(walletCarouselTabStorageKey(ownerKey), next);
      } catch {
        /* storage unavailable */
      }
    },
    [ownerKey],
  );

  const move = useCallback(
    (delta: number) =>
      setIndex((current) =>
        clampCarouselIndex(current + delta, groups[tab].length),
      ),
    [groups, tab],
  );

  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);
  const trackX = width
    ? (width - cardWidth) / 2 - activeIndex * (cardWidth + CARD_GAP_PX)
    : 0;

  // ---- dialogs: pinned to the wallet that was shown when the action fired ----
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [dialogWalletId, setDialogWalletId] = useState<number | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const dialogWallet = useMemo(
    () => wallets.find((w) => w.id === dialogWalletId) ?? null,
    [wallets, dialogWalletId],
  );

  const openAction = (action: WalletCarouselQuickAction) => {
    if (!activeWallet) return;
    setDialogWalletId(activeWallet.id);
    setDialog(action);
  };

  const closeDialog = () => {
    setDialog(null);
    setExpenseError(null);
    setIncomeError(null);
    setPaymentError(null);
    setCreateError(null);
  };

  const fundingWalletOptions = useMemo<PaymentMethodOption[]>(
    () =>
      wallets
        .filter((w) => w.type === 'CASH' || w.type === 'DEBIT_CARD')
        .map((w) => ({
          id: w.id,
          name: w.name,
          provider_icon_key: w.provider_icon_key,
          type: w.type,
          amount: w.amount,
          credit_limit: w.credit_limit ?? null,
          temporary_credit_limit: w.temporary_credit_limit ?? null,
        })),
    [wallets],
  );

  const handleCreateExpense = async (values: AddExpenseFormValues) => {
    setExpenseError(null);
    try {
      await clientFetchFromApi(
        '/api/expenses',
        { method: 'POST', body: JSON.stringify(values) },
        context,
      );
      toast.success('Gasto registrado');
      closeDialog();
      await onRefresh();
    } catch (err) {
      setExpenseError(
        err instanceof Error ? err.message : 'No se pudo crear el gasto',
      );
      throw err;
    }
  };

  const handleCreateIncome = async (values: AddIncomeFormValues) => {
    setIncomeError(null);
    try {
      await createWalletIncome(
        values.walletId,
        {
          date: values.date,
          amount: values.amount,
          source: values.name,
          category_id: values.categoryId,
        },
        context,
      );
      toast.success('Ingreso registrado');
      closeDialog();
      await onRefresh();
    } catch (err) {
      setIncomeError(
        err instanceof Error ? err.message : 'No se pudo registrar el ingreso',
      );
      throw err;
    }
  };

  const handleCardPayment = async (data: CreditCardPaymentSubmitPayload) => {
    if (!dialogWallet) return;
    try {
      setPaymentSubmitting(true);
      setPaymentError(null);
      await createCreditCardPayment(
        dialogWallet.id,
        { mode: 'wallet', ...data, create_fortnight_expense: true },
        context,
      );
      toast.success('Pago registrado');
      closeDialog();
      await onRefresh();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Error al registrar el pago',
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleCreateWallet = async (data: WalletFormValues) => {
    try {
      setCreateError(null);
      const payload = {
        name: data.name,
        amount: data.amount || 0,
        credit_limit: data.credit_limit ?? null,
        temporary_credit_limit: data.temporary_credit_limit ?? null,
        type: data.type,
        provider_icon_key: data.provider_icon_key ?? null,
        active: data.active || true,
        include_in_liquidity: data.include_in_liquidity ?? true,
        cutoff_day: data.cutoff_day || null,
        due_day: data.due_day || null,
        minimum_payment: data.minimum_payment ?? null,
        apr_annual: data.apr_annual ?? null,
        cat_annual: data.cat_annual ?? null,
        goal_amount: data.goal_amount ?? null,
        goal_due_date: data.goal_due_date ?? null,
        assignee_user_id: data.assignee_user_id ?? null,
      };
      const created = isCreditCarouselType(data.type)
        ? await createCreditCard(payload, context)
        : await createWallet(payload, context);
      toast.success(
        isCreditCarouselType(data.type) ? 'Tarjeta creada' : 'Billetera creada',
      );
      closeDialog();
      const nextTab = (
        WALLET_CAROUSEL_TYPES as readonly string[]
      ).includes(data.type)
        ? (data.type as WalletCarouselType)
        : tab;
      selectTab(nextTab);
      await onRefresh();
      // Jump to the new card once the refreshed list arrives.
      const createdId = (created as { id?: number } | undefined)?.id;
      if (createdId != null) setPendingFocusId(createdId);
      else setIndex(Number.MAX_SAFE_INTEGER);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear');
      throw err;
    }
  };

  const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);
  useEffect(() => {
    if (pendingFocusId == null) return;
    const found = groups[tab].findIndex((w) => w.id === pendingFocusId);
    if (found >= 0) {
      setIndex(found);
      setPendingFocusId(null);
    }
  }, [groups, pendingFocusId, tab]);

  const plan = activeWallet
    ? getWalletCarouselActionPlan(activeWallet.type)
    : null;
  const dialogPlan = dialogWallet
    ? getWalletCarouselActionPlan(dialogWallet.type)
    : null;
  const dialogSummary = dialogWallet ? getWalletCreditSummary(dialogWallet) : null;

  return (
    <section
      aria-label="Billeteras"
      className={cn(
        'min-w-0 space-y-3 rounded-xl border border-border/60 bg-card/60 p-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Tipo de billetera"
          className="inline-flex min-w-0 items-center rounded-full border border-border/60 bg-background/60 p-0.5"
        >
          {WALLET_CAROUSEL_TYPES.map((type) => {
            const count = groups[type].length;
            const selected = type === tab;
            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(type)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  selected
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                  count === 0 && !selected && 'opacity-50',
                )}
              >
                {WALLET_CAROUSEL_TAB_LABELS[type]}
                <span className="tabular-nums text-caption opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => {
            setDialogWalletId(null);
            setDialog('create');
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Agregar billetera
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="flex h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 text-center">
          <p className="text-sm text-muted-foreground">
            Sin billeteras de tipo {WALLET_CAROUSEL_TAB_LABELS[tab].toLowerCase()}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setDialogWalletId(null);
              setDialog('create');
            }}
          >
            Agregar billetera
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            ref={viewportRef}
            className="relative overflow-hidden"
            role="group"
            aria-roledescription="carrusel"
            aria-label={`Billeteras de ${WALLET_CAROUSEL_TAB_LABELS[tab]}`}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') move(-1);
              if (event.key === 'ArrowRight') move(1);
            }}
          >
            <motion.div
              className="flex h-[168px] cursor-grab touch-pan-y active:cursor-grabbing"
              style={{ gap: CARD_GAP_PX }}
              drag={list.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              animate={{ x: trackX }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 260, damping: 30 }
              }
              onDragEnd={(_, info) =>
                move(
                  resolveCarouselSwipe({
                    offsetX: info.offset.x,
                    velocityX: info.velocity.x,
                  }),
                )
              }
            >
              {list.map((wallet, i) => {
                const active = i === activeIndex;
                return (
                  <motion.div
                    key={wallet.id}
                    className="h-full shrink-0"
                    style={{ width: cardWidth || '74%' }}
                    animate={{
                      scale: active || reduceMotion ? 1 : 0.9,
                      opacity: active ? 1 : 0.55,
                    }}
                    transition={reduceMotion ? { duration: 0 } : undefined}
                    aria-hidden={!active}
                    onClick={() => !active && setIndex(i)}
                  >
                    <WalletFace wallet={wallet} isActive={active} />
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {list.length > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="Billetera anterior"
                className="hidden rounded-full p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 sm:inline-flex"
                disabled={activeIndex === 0}
                onClick={() => move(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {list.map((wallet, i) => (
                  <button
                    key={wallet.id}
                    type="button"
                    aria-label={`Ver ${wallet.name}`}
                    aria-current={i === activeIndex}
                    onClick={() => setIndex(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === activeIndex
                        ? 'w-4 bg-foreground'
                        : 'w-1.5 bg-muted-foreground/40',
                    )}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Billetera siguiente"
                className="hidden rounded-full p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 sm:inline-flex"
                disabled={activeIndex === list.length - 1}
                onClick={() => move(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      )}

      {activeWallet && plan ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Acciones rápidas
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1 px-2"
              onClick={() => openAction(plan.topUp)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Saldo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1 px-2"
              onClick={() => openAction(plan.addExpense)}
            >
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              Gasto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1 px-2"
              onClick={() => openAction(plan.request)}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
              {plan.requestLabel}
            </Button>
            <Button
              asChild
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
            >
              <Link
                href={`/wallets/${activeWallet.id}`}
                aria-label={`Historial de ${activeWallet.name}`}
              >
                <History className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {dialogWallet && dialogPlan ? (
        <>
          <WalletBalanceDialog
            open={dialog === 'balance'}
            onOpenChange={(open) => !open && closeDialog()}
            walletId={dialogWallet.id}
            walletName={dialogWallet.name}
            currentAmount={dialogWallet.amount}
            context={context}
            onSuccess={() => {
              closeDialog();
              void onRefresh();
            }}
            variant={dialogPlan.balanceVariant}
            creditLimit={dialogWallet.credit_limit}
          />

          {dialogPlan.balanceVariant === 'funding' ? (
            <AddTransactionDialog
              open={dialog === 'expense' || dialog === 'income'}
              onOpenChange={(open) => !open && closeDialog()}
              defaultTab={dialog === 'income' ? 'income' : 'expense'}
              expenseDefaults={{ paymentMethodId: dialogWallet.id, isPaid: true }}
              incomeDefaults={{ walletId: dialogWallet.id }}
              onSaveExpense={handleCreateExpense}
              onSaveIncome={handleCreateIncome}
              expenseError={expenseError}
              incomeError={incomeError}
            />
          ) : (
            <>
              <CreditCardQuickPurchaseDialog
                open={dialog === 'purchase'}
                onOpenChange={(open) => !open && closeDialog()}
                creditCardId={dialogWallet.id}
                context={context}
                onSuccess={() => {
                  closeDialog();
                  void onRefresh();
                }}
                availableCredit={dialogSummary?.available ?? null}
                creditLimit={dialogSummary?.limit ?? null}
              />
              <CreditCardPaymentDialog
                open={dialog === 'payment'}
                onOpenChange={(open) => !open && closeDialog()}
                fundingWalletOptions={fundingWalletOptions}
                prefillAmount={null}
                submitting={paymentSubmitting}
                error={paymentError}
                onConfirm={handleCardPayment}
              />
            </>
          )}
        </>
      ) : null}

      <WalletForm
        open={dialog === 'create'}
        onOpenChange={(open) => !open && closeDialog()}
        onSave={handleCreateWallet}
        mode="create"
        allowedTypes={[...WALLET_CAROUSEL_TYPES]}
        defaultValues={{ type: tab }}
        error={createError && dialog === 'create' ? createError : null}
      />
    </section>
  );
};

export default WalletCarouselPanel;
