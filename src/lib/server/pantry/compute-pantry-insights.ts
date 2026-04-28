import type {
  PantryChartsDto,
  PantryGuardrailAlertDto,
  PantryHighlightsDto,
  PantryInsightsDto,
  PantryMonthlySeriesPointDto,
  PantryPriceChangeDto,
  PantryProductSpendPointDto,
  PantryStoreInsightDto,
  PantryStoreRecommendationDto,
  PantryTopProductDto,
} from '@/types/pantry-insights';
import { decimalToNumber } from '@/lib/server/pantry/serialize-pantry-receipt';

export const normalizePantryProductKey = (description: string): string =>
  description.trim().toLowerCase().replace(/\s+/g, ' ');

type ReceiptLineRow = {
  description: string;
  quantity: unknown;
  line_total: unknown;
  unit_price: unknown;
};

type ReceiptRow = {
  title: string | null;
  grand_total: unknown;
  currency: string;
  store?: string | null;
  purchased_at: Date | null;
  created_at: Date;
  lines: ReceiptLineRow[];
};

type PricePoint = { at: Date; price: number };

const roundMoney = (n: number) => Math.round(n * 100) / 100;

const lineQuantity = (row: ReceiptLineRow): number => {
  const q = decimalToNumber(row.quantity);
  if (q == null || !Number.isFinite(q) || q <= 0) return 0;
  return q;
};

const lineSpend = (row: ReceiptLineRow): number => {
  const t = decimalToNumber(row.line_total);
  return t != null && Number.isFinite(t) ? Math.max(0, t) : 0;
};

const effectiveUnitPrice = (row: ReceiptLineRow): number | null => {
  const direct = decimalToNumber(row.unit_price);
  if (direct != null && Number.isFinite(direct) && direct > 0) {
    return roundMoney(direct);
  }
  const qty = lineQuantity(row);
  const spend = lineSpend(row);
  if (qty > 0 && spend > 0) return roundMoney(spend / qty);
  return null;
};

const receiptTimestamp = (r: ReceiptRow): Date =>
  r.purchased_at ?? r.created_at;

const receiptTotalAmount = (r: ReceiptRow): number => {
  const sum = roundMoney(
    r.lines.reduce((acc, line) => acc + lineSpend(line), 0),
  );
  const g = decimalToNumber(r.grand_total);
  if (sum > 0) return sum;
  if (g != null && g > 0) return roundMoney(g);
  return 0;
};

const MAX_MONTH_BUCKETS = 36;
const CHART_TOP_SPEND_PRODUCTS = 10;
const BUY_BETTER_LIMIT = 8;

const monthKeyFromDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
};

const labelFromMonthKey = (key: string): string => {
  const [ys, ms] = key.split('-').map(Number);
  return new Date(ys, ms - 1, 1).toLocaleDateString('es-MX', {
    month: 'short',
    year: 'numeric',
  });
};

const nextMonthKey = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
};

const buildSpendByMonth = (
  receipts: ReceiptRow[],
): PantryMonthlySeriesPointDto[] => {
  if (receipts.length === 0) return [];

  const map = new Map<string, { spend: number; count: number }>();
  for (const r of receipts) {
    const k = monthKeyFromDate(receiptTimestamp(r));
    const t = receiptTotalAmount(r);
    const cur = map.get(k) ?? { spend: 0, count: 0 };
    cur.spend += t;
    cur.count += 1;
    map.set(k, cur);
  }

  const sortedKeys = [...map.keys()].sort((a, b) => a.localeCompare(b));
  const start = sortedKeys[0]!;
  const end = sortedKeys[sortedKeys.length - 1]!;

  const out: PantryMonthlySeriesPointDto[] = [];
  let walk = start;
  let guard = 0;
  while (guard < 120) {
    const b = map.get(walk) ?? { spend: 0, count: 0 };
    out.push({
      period: walk,
      label: labelFromMonthKey(walk),
      total_spend: roundMoney(b.spend),
      receipt_count: b.count,
    });
    if (walk === end) break;
    walk = nextMonthKey(walk);
    guard += 1;
  }

  if (out.length > MAX_MONTH_BUCKETS) {
    return out.slice(-MAX_MONTH_BUCKETS);
  }
  return out;
};

const emptyHighlights = (): PantryHighlightsDto => ({
  last_purchase: null,
  first_purchase: null,
  most_expensive_receipt: null,
  cheapest_receipt: null,
  largest_line_item: null,
  average_lines_per_receipt: null,
  average_line_spend: null,
});

const buildHighlights = (
  receipts: ReceiptRow[],
  totalSpend: number,
  totalLineItems: number,
): PantryHighlightsDto => {
  if (receipts.length === 0) return emptyHighlights();

  type Enriched = {
    at: Date;
    total: number;
    title: string | null;
  };

  const enriched: Enriched[] = receipts.map((r) => ({
    at: receiptTimestamp(r),
    total: receiptTotalAmount(r),
    title: r.title?.trim() || null,
  }));

  const byTimeAsc = [...enriched].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  );
  const byTimeDesc = [...enriched].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );

  const first = byTimeAsc[0]!;
  const last = byTimeDesc[0]!;

  const withPositiveTotal = enriched.filter((e) => e.total > 0);
  let mostExp: Enriched | null = null;
  let cheapest: Enriched | null = null;
  for (const e of withPositiveTotal) {
    if (!mostExp || e.total > mostExp.total) mostExp = e;
    if (!cheapest || e.total < cheapest.total) cheapest = e;
  }

  let largestLine: {
    label: string;
    line_total: number;
    at: Date;
  } | null = null;
  for (const r of receipts) {
    const at = receiptTimestamp(r);
    for (const line of r.lines) {
      const spend = lineSpend(line);
      if (spend <= 0) continue;
      if (!largestLine || spend > largestLine.line_total) {
        largestLine = {
          label: line.description.trim(),
          line_total: roundMoney(spend),
          at,
        };
      }
    }
  }

  const receiptCount = receipts.length;
  const avgLines =
    receiptCount > 0
      ? Math.round((totalLineItems / receiptCount) * 100) / 100
      : null;
  const avgLineSpend =
    totalLineItems > 0 ? roundMoney(totalSpend / totalLineItems) : null;

  const snap = (e: Enriched) => ({
    at: e.at.toISOString(),
    total: e.total,
    title: e.title,
  });

  return {
    last_purchase: snap(last),
    first_purchase: {
      at: first.at.toISOString(),
      title: first.title,
    },
    most_expensive_receipt: mostExp ? snap(mostExp) : null,
    cheapest_receipt: cheapest ? snap(cheapest) : null,
    largest_line_item: largestLine
      ? {
          label: largestLine.label,
          line_total: largestLine.line_total,
          at: largestLine.at.toISOString(),
        }
      : null,
    average_lines_per_receipt: avgLines,
    average_line_spend: avgLineSpend,
  };
};

const collapseSamePrice = (points: PricePoint[]): PricePoint[] => {
  const out: PricePoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.price - p.price) < 0.005) continue;
    out.push(p);
  }
  return out;
};

const buildTopProducts = (
  receipts: ReceiptRow[],
  limit: number,
): PantryTopProductDto[] => {
  const map = new Map<
    string,
    { label: string; purchase_count: number; total_quantity: number; total_spend: number }
  >();

  for (const r of receipts) {
    for (const line of r.lines) {
      const key = normalizePantryProductKey(line.description);
      if (!key) continue;
      const spend = lineSpend(line);
      const qty = lineQuantity(line);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          label: line.description.trim(),
          purchase_count: 1,
          total_quantity: qty > 0 ? qty : 0,
          total_spend: spend,
        });
      } else {
        prev.purchase_count += 1;
        prev.total_quantity += qty > 0 ? qty : 0;
        prev.total_spend += spend;
        if (line.description.trim().length > prev.label.length) {
          prev.label = line.description.trim();
        }
      }
    }
  }

  return [...map.entries()]
    .map(([, v]) => ({
      label: v.label,
      purchase_count: v.purchase_count,
      total_quantity: roundMoney(v.total_quantity),
      total_spend: roundMoney(v.total_spend),
    }))
    .sort((a, b) => b.purchase_count - a.purchase_count)
    .slice(0, limit);
};

const buildProductsBySpend = (
  receipts: ReceiptRow[],
  limit: number,
): PantryProductSpendPointDto[] => {
  const rows = buildTopProducts(receipts, 80);
  return [...rows]
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, limit)
    .map((p) => ({ label: p.label, total_spend: p.total_spend }));
};

const buildCharts = (receipts: ReceiptRow[]): PantryChartsDto => ({
  spend_by_month: buildSpendByMonth(receipts),
  products_by_spend: buildProductsBySpend(receipts, CHART_TOP_SPEND_PRODUCTS),
});

const buildSpendByStore = (receipts: ReceiptRow[]): PantryStoreInsightDto[] => {
  const rows = new Map<string, { receipt_count: number; total_spend: number }>();
  for (const receipt of receipts) {
    const store = receipt.store?.trim();
    if (!store) continue;
    const prev = rows.get(store) ?? { receipt_count: 0, total_spend: 0 };
    prev.receipt_count += 1;
    prev.total_spend += receiptTotalAmount(receipt);
    rows.set(store, prev);
  }
  return [...rows.entries()]
    .map(([store, value]) => ({
      store,
      receipt_count: value.receipt_count,
      total_spend: roundMoney(value.total_spend),
      average_ticket:
        value.receipt_count > 0
          ? roundMoney(value.total_spend / value.receipt_count)
          : null,
    }))
    .sort((a, b) => b.total_spend - a.total_spend);
};

const buildBuyBetterRecommendations = (
  receipts: ReceiptRow[],
): PantryStoreRecommendationDto[] => {
  const byProduct = new Map<
    string,
    Map<string, { label: string; latest_at: Date; latest_unit_price: number }>
  >();
  for (const receipt of receipts) {
    const store = receipt.store?.trim();
    if (!store) continue;
    const at = receiptTimestamp(receipt);
    for (const line of receipt.lines) {
      const key = normalizePantryProductKey(line.description);
      if (!key) continue;
      const unitPrice = effectiveUnitPrice(line);
      if (unitPrice == null) continue;
      const productBucket = byProduct.get(key) ?? new Map();
      const current = productBucket.get(store);
      if (!current || at.getTime() >= current.latest_at.getTime()) {
        productBucket.set(store, {
          label: line.description.trim(),
          latest_at: at,
          latest_unit_price: unitPrice,
        });
      }
      byProduct.set(key, productBucket);
    }
  }

  const output: PantryStoreRecommendationDto[] = [];
  for (const [, stores] of byProduct) {
    if (stores.size < 2) continue;
    const points = [...stores.entries()].sort(
      (a, b) => a[1].latest_unit_price - b[1].latest_unit_price,
    );
    const best = points[0];
    const second = points[1];
    if (!best || !second) continue;
    const diff = second[1].latest_unit_price - best[1].latest_unit_price;
    if (diff <= 0) continue;
    output.push({
      label: best[1].label,
      recommended_store: best[0],
      candidate_stores: points.map(([store]) => store),
      latest_unit_price: best[1].latest_unit_price,
      recommendation_reason: `Ahorro estimado de ${roundMoney(diff)} vs la segunda mejor opción.`,
    });
  }

  return output.slice(0, BUY_BETTER_LIMIT);
};

const buildGuardrailAlerts = (
  monthlySpend: PantryMonthlySeriesPointDto[],
): PantryGuardrailAlertDto[] => {
  if (monthlySpend.length < 2) return [];
  const recent = monthlySpend.slice(-4);
  const last = recent[recent.length - 1];
  if (!last) return [];
  const baselineRows = recent.slice(0, -1).filter((r) => r.total_spend > 0);
  if (baselineRows.length === 0) return [];
  const baseline =
    baselineRows.reduce((acc, row) => acc + row.total_spend, 0) /
    baselineRows.length;
  if (baseline <= 0) return [];
  const ratio = last.total_spend / baseline;
  if (ratio < 1.25) return [];
  const severity: PantryGuardrailAlertDto['severity'] =
    ratio >= 1.6 ? 'high' : ratio >= 1.4 ? 'medium' : 'low';
  return [
    {
      type: 'CART_ESTIMATE_SPIKE',
      severity,
      message: `El gasto del último mes está ${Math.round((ratio - 1) * 100)}% arriba del promedio reciente.`,
    },
  ];
};

const buildPriceChanges = (receipts: ReceiptRow[]): {
  increases: PantryPriceChangeDto[];
  decreases: PantryPriceChangeDto[];
} => {
  const byKey = new Map<string, { label: string; points: PricePoint[] }>();

  for (const r of receipts) {
    const at = receiptTimestamp(r);
    for (const line of r.lines) {
      const key = normalizePantryProductKey(line.description);
      if (!key) continue;
      const price = effectiveUnitPrice(line);
      if (price == null || price <= 0) continue;
      const bucket = byKey.get(key);
      if (!bucket) {
        byKey.set(key, {
          label: line.description.trim(),
          points: [{ at, price }],
        });
      } else {
        if (line.description.trim().length > bucket.label.length) {
          bucket.label = line.description.trim();
        }
        bucket.points.push({ at, price });
      }
    }
  }

  const changes: PantryPriceChangeDto[] = [];

  for (const [, { label, points }] of byKey) {
    const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
    const collapsed = collapseSamePrice(sorted);
    if (collapsed.length < 2) continue;
    const previous = collapsed[collapsed.length - 2]!;
    const latest = collapsed[collapsed.length - 1]!;
    const changeAmount = roundMoney(latest.price - previous.price);
    if (Math.abs(changeAmount) < 0.005) continue;
    const changePercent =
      previous.price > 0
        ? Math.round((changeAmount / previous.price) * 10000) / 100
        : null;
    changes.push({
      label,
      previous_unit_price: previous.price,
      latest_unit_price: latest.price,
      change_amount: changeAmount,
      change_percent: changePercent,
      latest_at: latest.at.toISOString(),
      previous_at: previous.at.toISOString(),
    });
  }

  const increases = changes
    .filter((c) => c.change_amount > 0)
    .sort((a, b) => {
      const pa = a.change_percent ?? -Infinity;
      const pb = b.change_percent ?? -Infinity;
      if (pb !== pa) return pb - pa;
      return new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime();
    });

  const decreases = changes
    .filter((c) => c.change_amount < 0)
    .sort((a, b) => {
      const pa = a.change_percent ?? Infinity;
      const pb = b.change_percent ?? Infinity;
      if (pa !== pb) return pa - pb;
      return new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime();
    });

  return { increases, decreases };
};

export const computePantryInsights = (
  receipts: ReceiptRow[],
  options?: { topProductsLimit?: number },
): PantryInsightsDto => {
  const topProductsLimit = options?.topProductsLimit ?? 12;
  const currency = receipts[0]?.currency ?? 'MXN';

  let totalSpend = 0;
  let totalLineItems = 0;
  const keys = new Set<string>();
  const unitPrices: number[] = [];

  for (const r of receipts) {
    for (const line of r.lines) {
      totalLineItems += 1;
      totalSpend += lineSpend(line);
      const k = normalizePantryProductKey(line.description);
      if (k) keys.add(k);
      const up = effectiveUnitPrice(line);
      if (up != null && up > 0) unitPrices.push(up);
    }
  }

  const receiptCount = receipts.length;
  const avgReceipt =
    receiptCount > 0 ? roundMoney(totalSpend / receiptCount) : null;
  const avgUnit =
    unitPrices.length > 0
      ? roundMoney(
          unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length,
        )
      : null;

  const { increases, decreases } = buildPriceChanges(receipts);
  const highlights = buildHighlights(receipts, totalSpend, totalLineItems);
  const charts = buildCharts(receipts);
  const spendByStore = buildSpendByStore(receipts);
  const buyBetterRecommendations = buildBuyBetterRecommendations(receipts);
  const guardrailAlerts = buildGuardrailAlerts(charts.spend_by_month);

  return {
    currency,
    metrics: {
      total_spend: roundMoney(totalSpend),
      receipt_count: receiptCount,
      distinct_products: keys.size,
      total_line_items: totalLineItems,
      average_receipt_spend: avgReceipt,
      average_unit_price: avgUnit,
    },
    highlights,
    charts,
    top_products: buildTopProducts(receipts, topProductsLimit),
    price_increases: increases,
    price_decreases: decreases,
    spend_by_store: spendByStore,
    buy_better_recommendations: buyBetterRecommendations,
    guardrail_alerts: guardrailAlerts,
  };
};
