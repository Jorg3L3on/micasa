"use client";

import { Banknote, ChevronRight, Receipt, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { SwipeDeleteRow } from "@/components/ui/swipe-delete-row";
import { WalletIdentity } from "@/components/wallets/WalletIdentity";
import {
  scheduleLabel,
  type ScheduledPeriod,
  type ScheduledView,
} from "@/lib/ui/scheduled-items";
import { cn } from "@/lib/utils";
import {
  mobileLine,
  NO_DATE_LABEL,
  NO_WALLET_LABEL,
  type ScheduledRowModel,
} from "./scheduled-rows";
import { QUINCENA_CHIP_CLASS } from "./scheduled-tokens";

/** Fixed columns from `md`: Concepto, Cuándo, wallet, Monto, actions. */
export const SCHEDULED_GRID_CLASS =
  "md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_4.75rem] md:items-center md:gap-x-4";

type ScheduledRowProps = {
  row: ScheduledRowModel;
  view: ScheduledView;
  /** Swipe to delete is on below `md` only (Viewport Delete Rule). */
  swipeEnabled: boolean;
  onOpen: (row: ScheduledRowModel) => void;
  onRequestDelete: (row: ScheduledRowModel) => void;
};

export const RowIcon = ({
  row,
  className,
  iconClassName = "h-[18px] w-[18px]",
}: {
  row: ScheduledRowModel;
  className?: string;
  iconClassName?: string;
}) => {
  const Fallback = row.item.kind === "income" ? Banknote : Receipt;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground",
        className,
      )}
    >
      {row.categoryIcon ? (
        <CategoryIcon
          icon={row.categoryIcon}
          iconClassName={iconClassName}
        />
      ) : (
        <Fallback className={iconClassName} strokeWidth={1.8} />
      )}
    </span>
  );
};

export const SubscriptionBadge = () => (
  <Badge
    variant="outline"
    className="shrink-0 rounded-full px-2 py-0 text-caption font-normal"
  >
    Suscripción
  </Badge>
);

const InactiveBadge = () => (
  <Badge
    variant="outline"
    className="shrink-0 rounded-full px-2 py-0 text-caption font-normal"
  >
    Inactivo
  </Badge>
);

const ScheduleChips = ({ row }: { row: ScheduledRowModel }) => {
  const { item } = row;
  const periods = (["FIRST", "SECOND"] as const).filter((p: ScheduledPeriod) =>
    p === "FIRST" ? item.appliesFirst : item.appliesSecond,
  );
  if (periods.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">{NO_DATE_LABEL}</span>
    );
  }
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {periods.map((period) => (
        <span
          key={period}
          className={cn(
            "whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
            QUINCENA_CHIP_CLASS[period],
          )}
        >
          {item.kind === "income"
            ? period === "FIRST"
              ? "1ª quincena"
              : "2ª quincena"
            : scheduleLabel(item, period)}
        </span>
      ))}
    </div>
  );
};

const Amount = ({
  row,
  view,
  size = "row",
}: {
  row: ScheduledRowModel;
  view: ScheduledView;
  size?: "row" | "mobile";
}) => {
  const { item } = row;
  if (item.amount === null) {
    return (
      <span
        className={cn(
          "font-medium text-muted-foreground",
          size === "mobile" ? "text-[15px]" : "text-sm",
        )}
      >
        Variable
      </span>
    );
  }
  const both = view === "all" && item.appliesFirst && item.appliesSecond;
  return (
    <span className="flex flex-col items-end">
      <Money
        value={item.amount}
        tone={item.kind === "income" ? "positive" : "neutral"}
        className={size === "mobile" ? "text-[15px]" : undefined}
      />
      {both ? (
        <span className="text-caption text-muted-foreground">por quincena</span>
      ) : null}
    </span>
  );
};

/** One Gastos / Ingresos programados row: grid from `md`, one button below. */
export const ScheduledRow = ({
  row,
  view,
  swipeEnabled,
  onOpen,
  onRequestDelete,
}: ScheduledRowProps) => {
  const { item } = row;
  const deleteLabel = `Eliminar ${item.name}`;
  const muted = !item.active;

  return (
    <li className="border-t border-border/60 first:border-t-0">
      {/* From md */}
      <div
        className={cn(
          "relative hidden min-h-[60px] px-5 transition-colors hover:bg-muted/40",
          SCHEDULED_GRID_CLASS,
          muted && "text-muted-foreground",
        )}
        data-testid="scheduled-row-desktop"
      >
        <button
          type="button"
          title={item.name}
          onClick={() => onOpen(row)}
          className="flex min-w-0 items-center gap-3 py-2 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
        >
          <RowIcon row={row} className="size-9 rounded-[10px]" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{item.name}</span>
            <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              {row.detail ? (
                <span className="truncate">{row.detail}</span>
              ) : null}
              {item.isSubscription ? <SubscriptionBadge /> : null}
              {muted ? <InactiveBadge /> : null}
            </span>
          </span>
        </button>
        <ScheduleChips row={row} />
        <div className="min-w-0 text-sm">
          {row.walletName ? (
            <WalletIdentity
              name={row.walletName}
              providerIconKey={row.walletIconKey}
              className="max-w-full"
              nameClassName="text-sm font-normal"
              iconClassName="h-[22px] w-[22px]"
            />
          ) : (
            <span className="text-muted-foreground">{NO_WALLET_LABEL}</span>
          )}
        </div>
        <div className="flex min-w-0 justify-end">
          <Amount row={row} view={view} />
        </div>
        <div className="relative z-10 flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label={deleteLabel}
            title="Eliminar"
            onClick={() => onRequestDelete(row)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      {/* Below md. SwipeDeleteRow renders no wrapper while swipe is off. */}
      <div className="md:hidden">
        <SwipeDeleteRow
          enabled={swipeEnabled}
          onRequestDelete={() => onRequestDelete(row)}
          deleteAriaLabel={deleteLabel}
        >
          <button
            type="button"
            title={item.name}
            onClick={() => onOpen(row)}
            data-testid="scheduled-row-mobile"
            className={cn(
              "flex min-h-16 w-full min-w-0 items-center gap-3 bg-card py-2 pl-3.5 pr-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
              muted && "text-muted-foreground",
            )}
          >
            <RowIcon row={row} className="size-10" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[15px] font-medium">
                  {item.name}
                </span>
                {item.isSubscription ? <SubscriptionBadge /> : null}
                {muted ? <InactiveBadge /> : null}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {mobileLine(row, view)}
              </span>
            </span>
            <span className="shrink-0">
              <Amount row={row} view={view} size="mobile" />
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </SwipeDeleteRow>
      </div>
    </li>
  );
};
