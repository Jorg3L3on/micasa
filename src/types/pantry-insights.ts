export type PantryTopProductDto = {
  label: string;
  purchase_count: number;
  total_quantity: number;
  total_spend: number;
};

export type PantryPriceChangeDto = {
  label: string;
  previous_unit_price: number;
  latest_unit_price: number;
  change_amount: number;
  change_percent: number | null;
  /** ISO timestamp of the purchase where the latest price was observed */
  latest_at: string;
  /** ISO timestamp of the previous price observation */
  previous_at: string;
};

/** Single receipt snapshot (date + total + optional title) */
export type PantryReceiptSnapshotDto = {
  at: string;
  total: number;
  title: string | null;
};

export type PantryLineHighlightDto = {
  label: string;
  line_total: number;
  at: string;
};

export type PantryHighlightsDto = {
  last_purchase: PantryReceiptSnapshotDto | null;
  first_purchase: { at: string; title: string | null } | null;
  most_expensive_receipt: PantryReceiptSnapshotDto | null;
  cheapest_receipt: PantryReceiptSnapshotDto | null;
  largest_line_item: PantryLineHighlightDto | null;
  average_lines_per_receipt: number | null;
  average_line_spend: number | null;
};

/** One calendar month bucket for trend charts (local month from receipt date) */
export type PantryMonthlySeriesPointDto = {
  /** YYYY-MM */
  period: string;
  /** Short label e.g. "mar 2026" */
  label: string;
  total_spend: number;
  receipt_count: number;
};

export type PantryProductSpendPointDto = {
  label: string;
  total_spend: number;
};

export type PantryChartsDto = {
  spend_by_month: PantryMonthlySeriesPointDto[];
  products_by_spend: PantryProductSpendPointDto[];
};

export type PantryInsightsDto = {
  currency: string;
  metrics: {
    total_spend: number;
    receipt_count: number;
    distinct_products: number;
    total_line_items: number;
    average_receipt_spend: number | null;
    average_unit_price: number | null;
  };
  highlights: PantryHighlightsDto;
  charts: PantryChartsDto;
  top_products: PantryTopProductDto[];
  price_increases: PantryPriceChangeDto[];
  price_decreases: PantryPriceChangeDto[];
};
