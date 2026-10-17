'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  History,
  Plus,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import AddTransactionDialog from '@/components/transactions/AddTransactionDialog';
import CreditCardPaymentDialog, {
  type CreditCardPaymentSubmitPayload,
} from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { SegmentedControl } from '@/components/segmented-control';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS, MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { Button } from '@/components/ui/button';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { ShineBorder } from '@/components/ui/shine-border';
import { getAuraBarStyle, getAuraWalletColor } from '@/lib/ui/aura-palette';
import { SectionHeader } from '@/components/section-header';
import { useFinanceContext } from '@/context/finance-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProviderCardScheme } from '@/hooks/use-provider-card-scheme';
import {
  PAYMENT_METHOD_SHORT_LABELS,
  type PaymentMethodType,
} from '@/domain/payment-method';
import { createCreditCardPayment } from '@/lib/api/credit-cards';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { createWalletIncome } from '@/lib/api/incomes';
import {
  getProviderCardStyle,
  getWalletAuraColors,
  isProviderCardDarkSurface,
} from '@/lib/provider-card-style';
import {
  carouselIndexFromScroll,
  carouselTypeRange,
  clampCarouselIndex,
  firstCarouselIndexOfType,
  getWalletCarouselActionPlan,
  getWalletCreditSummary,
  groupWalletsByCarouselType,
  isCreditCarouselType,
  isWalletCarouselType,
  orderWalletsForCarousel,
  resolveStoredCarouselIndex,
  WALLET_CAROUSEL_TAB_LABELS,
  WALLET_CAROUSEL_TYPES,
  walletCarouselActiveStorageKey,
  type WalletCarouselQuickAction,
  type WalletCarouselType,
} from '@/lib/ui/wallet-carousel';
import {
  applyWalletStripOrder,
  defaultWalletStripOrder,
  parseWalletStripOrder,
  walletStripOrderStorageKey,
} from '@/lib/ui/wallet-strip-order';
import { cn, formatCurrency } from '@/lib/utils';
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

type ActiveDialog = WalletCarouselQuickAction | null;

/** Card sizing follows a physical card (taller than wide-screen strips), capped so it stays narrow. */
const CARD_WIDTH_RATIO = 0.62;
const CARD_MAX_WIDTH_PX = 272;
const CARD_ASPECT_RATIO = 1.45;
const CARD_GAP_PX = 12;

/**
 * Static stand-in for InteractiveGridPattern on side cards: same 14px lines,
 * painted once by CSS instead of 280 SVG rects per card.
 */
const STATIC_GRID_CLASS =
  'pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:linear-gradient(115deg,white_10%,transparent_85%)]';

/**
 * Only the centered card gets the interactive grid and the animated shine
 * border: on every card they kept the track re-rastering, so fast trackpad
 * flicks outran painting and showed blank cards.
 */
const WalletFace = memo(function WalletFace({
  wallet,
  isActive,
}: {
  wallet: WalletListItem;
  isActive: boolean;
}) {
  const scheme = useProviderCardScheme();
  const credit = isCreditCarouselType(wallet.type);
  const summary = credit ? getWalletCreditSummary(wallet) : null;
  const usedPercent =
    summary?.limit != null && summary.limit > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((summary.used / summary.limit) * 100)),
        )
      : 0;
  const brandColor = getAuraWalletColor(
    wallet.provider_icon_key,
    wallet.type,
    'primary',
  );
  const style = getProviderCardStyle(
    wallet.provider_icon_key,
    wallet.type,
    'aura',
    scheme,
  );
  const auraColors = getWalletAuraColors(wallet.provider_icon_key, wallet.type);
  const dark = Boolean(style) && isProviderCardDarkSurface('aura', scheme);

  return (
    <div
      className={cn(
        'relative isolate flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-4',
        'ring-1 ring-inset',
        dark ? 'ring-white/5' : 'ring-black/5',
        !style && 'border-border/80 bg-card dark:border-border/60 dark:bg-card/80',
        style && 'shadow-face',
        style && (dark ? 'border-white/25' : 'border-border/70'),
        dark ? 'text-white' : 'text-foreground',
        !isActive && 'pointer-events-none',
      )}
      style={style}
    >
      {style ? (
        <>
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute -left-8 -top-10 h-20 w-20 rounded-full blur-2xl',
              dark ? 'bg-white/8' : 'bg-white/70',
            )}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute -right-8 -bottom-10 h-20 w-20 rounded-full blur-2xl',
              dark ? 'bg-black/20' : 'bg-black/5',
            )}
          />
        </>
      ) : null}
      {isActive ? (
        <InteractiveGridPattern
          width={14}
          height={14}
          squares={[20, 14]}
          className="-z-10 border-0 [mask-image:linear-gradient(115deg,white_10%,transparent_85%)]"
          squaresClassName={
            dark ? 'stroke-white/[0.08]' : 'stroke-foreground/[0.08]'
          }
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            STATIC_GRID_CLASS,
            dark ? 'text-white/[0.08]' : 'text-foreground/[0.08]',
          )}
        />
      )}
      {isActive && auraColors ? (
        <ShineBorder
          shineColor={auraColors.shine}
          borderWidth={1.5}
          duration={11}
          style={{ animationDelay: `-${(wallet.id % 7) * 1.6}s` }}
        />
      ) : null}
      <div className="pointer-events-none flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <WalletProviderIcon
            providerIconKey={wallet.provider_icon_key}
            showTooltipLabel={false}
          />
          <span className="truncate text-sm font-semibold" title={wallet.name}>
            {wallet.name}
          </span>
        </div>
        <span className="shrink-0 text-xs opacity-70">
          {PAYMENT_METHOD_SHORT_LABELS[wallet.type as PaymentMethodType] ??
            wallet.type}
        </span>
      </div>

      <div className="pointer-events-none">
        <p className="text-xs opacity-70">
          {credit ? 'Saldo utilizado' : 'Saldo'}
        </p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(wallet.amount)}
        </p>
        {summary?.limit != null && summary.limit > 0 ? (
          <div
            className={cn(
              'mt-2 h-1.5 overflow-hidden rounded-full',
              dark ? 'bg-white/15' : 'bg-foreground/10',
            )}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usedPercent}
            aria-label={`Disponible ${formatCurrency(summary.available ?? 0)} de ${formatCurrency(summary.limit)}`}
            title={`Disponible ${formatCurrency(summary.available ?? 0)} de ${formatCurrency(summary.limit)}`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${usedPercent}%`,
                ...getAuraBarStyle(brandColor),
              }}
            />
          </div>
        ) : null}
      </div>

      {credit && (wallet.cutoff_day != null || wallet.due_day != null) ? (
        <p className="pointer-events-none flex items-center justify-between gap-2 text-xs opacity-70">
          <span>
            {wallet.cutoff_day != null ? `Corte día ${wallet.cutoff_day}` : null}
          </span>
          <span className="text-right">
            {wallet.due_day != null ? `Vence día ${wallet.due_day}` : null}
          </span>
        </p>
      ) : (
        <span aria-hidden className="pointer-events-none h-4" />
      )}
    </div>
  );
});

export const WalletCarouselPanel = ({
  wallets,
  ownerKey,
  onRefresh,
  className,
}: WalletCarouselPanelProps) => {
  const { context } = useFinanceContext();
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();

  // The strip's drag order (saved per owner on tablet/mobile) orders cards
  // inside each type. Read through useSyncExternalStore so SSR sees no order.
  const stripOrderKey = walletStripOrderStorageKey(context.type, context.id);
  const savedStripOrderRaw = useSyncExternalStore(
    subscribeToStorage,
    () => readStorage(stripOrderKey),
    () => null,
  );
  const track = useMemo(
    () =>
      orderWalletsForCarousel(
        applyWalletStripOrder(
          defaultWalletStripOrder(wallets),
          parseWalletStripOrder(savedStripOrderRaw),
        ),
      ),
    [wallets, savedStripOrderRaw],
  );
  const groups = useMemo(() => groupWalletsByCarouselType(wallets), [wallets]);

  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const activeIndex = clampCarouselIndex(index, track.length);
  const activeWallet: WalletListItem | undefined = track[activeIndex];
  const activeType: WalletCarouselType = isWalletCarouselType(
    activeWallet?.type,
  )
    ? activeWallet.type
    : WALLET_CAROUSEL_TYPES[0];
  const typeRange = carouselTypeRange(track, activeIndex);

  // The viewport only exists while there are wallets to show, so measure it
  // whenever it (re)mounts.
  const hasViewport = track.length > 0;
  useEffect(() => {
    const el = viewportRef.current;
    if (!hasViewport || !el) return;
    // clientWidth includes the edge padding set on this same element;
    // contentRect would shrink by it and feed back into the card size.
    const observer = new ResizeObserver(() => {
      setWidth(el.clientWidth);
    });
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [hasViewport]);

  const cardWidth = Math.min(
    Math.round(width * CARD_WIDTH_RATIO),
    CARD_MAX_WIDTH_PX,
  );
  const cardHeight = cardWidth
    ? Math.round(cardWidth / CARD_ASPECT_RATIO)
    : 180;
  // 0 until the viewport is measured (a bare gap is not a card step).
  const step = cardWidth > 0 ? cardWidth + CARD_GAP_PX : 0;
  // Side padding lets the first and last cards snap to the center.
  const edgePadding = width ? Math.max(0, (width - cardWidth) / 2) : 0;

  // Card a programmatic scroll is heading to, so quick repeated presses
  // (arrows, ‹ ›) keep advancing before the smooth scroll settles.
  const targetIndexRef = useRef<number | null>(null);

  const scrollToIndex = useCallback(
    (next: number, instant = false) => {
      const el = viewportRef.current;
      if (!el || step <= 0) return;
      const target = clampCarouselIndex(next, track.length);
      targetIndexRef.current = target;
      el.scrollTo({
        left: target * step,
        behavior: instant || reduceMotion ? 'auto' : 'smooth',
      });
    },
    [step, track.length, reduceMotion],
  );

  const handleScroll = () => {
    const el = viewportRef.current;
    if (!el || step <= 0) return;
    const next = carouselIndexFromScroll(el.scrollLeft, step, track.length);
    if (next === targetIndexRef.current) targetIndexRef.current = null;
    if (next === index) return;
    setIndex(next);
    const wallet = track[next];
    if (!wallet) return;
    try {
      window.localStorage.setItem(
        walletCarouselActiveStorageKey(ownerKey),
        String(wallet.id),
      );
    } catch {
      /* storage unavailable */
    }
  };

  // Restore the remembered wallet once per owner, as soon as the track is measured.
  const restoredOwnerRef = useRef<string | null>(null);
  useEffect(() => {
    if (restoredOwnerRef.current === ownerKey) return;
    if (step <= 0 || track.length === 0) return;
    restoredOwnerRef.current = ownerKey;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(
        walletCarouselActiveStorageKey(ownerKey),
      );
    } catch {
      stored = null;
    }
    // Scrolling fires handleScroll, which syncs the index.
    scrollToIndex(resolveStoredCarouselIndex(track, stored), true);
  }, [ownerKey, step, track, scrollToIndex]);

  const move = (delta: number) =>
    scrollToIndex((targetIndexRef.current ?? activeIndex) + delta);

  const selectType = (type: WalletCarouselType) => {
    const first = firstCarouselIndexOfType(track, type);
    if (first >= 0) scrollToIndex(first);
  };

  // ---- dialogs: pinned to the wallet that was shown when the action fired ----
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [dialogWalletId, setDialogWalletId] = useState<number | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

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

  const plan = activeWallet
    ? getWalletCarouselActionPlan(activeWallet.type)
    : null;
  const dialogPlan = dialogWallet
    ? getWalletCarouselActionPlan(dialogWallet.type)
    : null;
  const dialogSummary = dialogWallet ? getWalletCreditSummary(dialogWallet) : null;

  if (isMobile) return null;

  const ownerQuery = buildOwnerQuery(context).toString();
  const walletsHref = ownerQuery ? `/wallets?${ownerQuery}` : '/wallets';
  const typeLabel = WALLET_CAROUSEL_TAB_LABELS[activeType];
  const typeCount = typeRange.end - typeRange.start;

  return (
    <aside
      className={cn(
        MONTHLY_LIQUID_PANEL_CLASS,
        'space-y-3 p-3 sm:space-y-4 sm:p-4',
        className,
      )}
      aria-label="Billeteras"
    >
      <SectionHeader
        icon={Wallet}
        title="Billeteras"
        subtitle="Saldos y tarjetas por tipo"
      />
      <SegmentedControl
        value={activeType}
        onValueChange={(value) => selectType(value as WalletCarouselType)}
        ariaLabel="Tipo de billetera"
        options={WALLET_CAROUSEL_TYPES.map((type) => ({
          value: type,
          ariaLabel: `${WALLET_CAROUSEL_TAB_LABELS[type]}, ${groups[type].length} ${
            groups[type].length === 1 ? 'billetera' : 'billeteras'
          }`,
          label: <span>{WALLET_CAROUSEL_TAB_LABELS[type]}</span>,
          disabled: groups[type].length === 0,
        }))}
        listClassName="w-full"
        stretch
        variant="segment"
        triggerClassName="px-2"
        indicatorClassName={AURA_TAB_INDICATOR_CLASS}
        activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
      />

      {track.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 text-center"
          style={{ height: cardHeight }}
        >
          <p className="text-sm text-muted-foreground">Sin billeteras</p>
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={walletsHref}>Ir a Billeteras</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Native horizontal scroll: trackpad swipes, shift+wheel and touch snap to one card. */}
          <div
            ref={viewportRef}
            className="relative flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-hide rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              gap: CARD_GAP_PX,
              height: cardHeight,
              paddingInline: edgePadding,
            }}
            role="group"
            aria-roledescription="carrusel"
            aria-label={`Billeteras de ${typeLabel}`}
            tabIndex={0}
            onScroll={handleScroll}
            onWheel={() => {
              targetIndexRef.current = null;
            }}
            onPointerDown={() => {
              targetIndexRef.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                move(-1);
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                move(1);
              }
            }}
          >
            {track.map((wallet, i) => {
              const active = i === activeIndex;
              return (
                <motion.div
                  key={wallet.id}
                  className={cn(
                    // Own compositor layer per card: scrolling moves layers
                    // instead of repainting the track.
                    'h-full shrink-0 snap-center snap-always will-change-transform',
                    !active && 'cursor-pointer',
                  )}
                  style={{ width: cardWidth || '62%' }}
                  animate={{
                    scale: active || reduceMotion ? 1 : 0.9,
                    opacity: active ? 1 : 0.55,
                  }}
                  transition={reduceMotion ? { duration: 0 } : undefined}
                  aria-hidden={!active}
                  onClick={() => !active && scrollToIndex(i)}
                >
                  <WalletFace wallet={wallet} isActive={active} />
                </motion.div>
              );
            })}
          </div>

          <p className="sr-only" aria-live="polite">
            {activeWallet
              ? `${activeWallet.name}, ${activeIndex - typeRange.start + 1} de ${typeCount} en ${typeLabel}`
              : null}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Billetera anterior"
              className={cn(
                'hidden rounded-full p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 sm:inline-flex',
                track.length <= 1 && 'invisible',
              )}
              disabled={activeIndex === 0}
              onClick={() => move(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* One dot per wallet of the active type. */}
            <div className="flex items-center gap-1.5">
              {track.slice(typeRange.start, typeRange.end).map((wallet, j) => {
                const i = typeRange.start + j;
                return (
                  <button
                    key={wallet.id}
                    type="button"
                    aria-label={`Ver ${wallet.name}`}
                    aria-current={i === activeIndex}
                    onClick={() => scrollToIndex(i)}
                    className={cn(
                      'relative h-1.5 rounded-full transition-all after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[""]',
                      i === activeIndex
                        ? 'w-4 bg-foreground'
                        : 'w-1.5 bg-muted-foreground/40',
                    )}
                  />
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Billetera siguiente"
              className={cn(
                'hidden rounded-full p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 sm:inline-flex',
                track.length <= 1 && 'invisible',
              )}
              disabled={activeIndex === track.length - 1}
              onClick={() => move(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {activeWallet && plan ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1 px-2 cursor-pointer"
            onClick={() => openAction(plan.topUp)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Ajustar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1 px-2 cursor-pointer"
            onClick={() => openAction(plan.addExpense)}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            Gasto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1 px-2 cursor-pointer"
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

    </aside>
  );
};

const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export default WalletCarouselPanel;
