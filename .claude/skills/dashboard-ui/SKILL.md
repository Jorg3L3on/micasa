---
name: dashboard-ui
description: Canonical layout, components, spacing and color conventions for MiCasa dashboard pages (Next.js 16 App Router + Tailwind v4 + Radix/shadcn). Use when creating or redesigning any page under `src/app/(dashboard)/**`.
when_to_use:
  - Creating a new dashboard page under `src/app/(dashboard)/`
  - Redesigning or polishing an existing dashboard page
  - Adding a metric strip / KPI cards
  - Choosing between Card grid and DataTable for a list view
  - Picking icon gradients, spacing, or border tokens
---

# MiCasa Dashboard UI

This skill encodes the conventions already established by the canonical pages: `dashboard/page.tsx`, `wallets/page.tsx`, `expenses/`, `credit-cards/`, and the pantry receipts page. New pages should match this dialect; existing divergent pages should be aligned with it (not the other way around).

The dashboard frame (sidebar, sticky header, container) is owned by `src/app/(dashboard)/layout.tsx`. **Pages render only their content** — do not re-wrap in another container or set their own background.

---

## Page anatomy

The layout already provides:

```tsx
<div className="flex flex-1 flex-col gap-4 p-4 pt-0 mt-4 min-h-screen bg-background">
  <div className="container mx-auto">{children}</div>
</div>
```

So a page's top-level wrapper is just spacing:

```tsx
<div className="space-y-5">
  {/* Sticky action bar (optional) */}
  {/* Metric strip (optional) */}
  {/* Primary card / table / grid */}
  {/* Secondary content (charts, side panels) */}
</div>
```

Use `space-y-5` for the standard rhythm; `space-y-6` when sections are visually heavy.

### Sticky action bar

Right-aligned filters + primary action. Mirrors `wallets/page.tsx:451`:

```tsx
<div className="sticky top-20 z-20 mb-4 flex flex-wrap items-center justify-end gap-2 bg-background/95 py-2 backdrop-blur supports-backdrop-filter:bg-background/80">
  <Button variant="outline" asChild>…</Button>
  <Button onClick={…}>…</Button>
</div>
```

If the page has both a title and an action, use **justify-between** instead of justify-end so the title sits on the left.

### Page title pattern

Inline title + subtitle, not the legacy `<PageHeader/>` with `text-3xl`. The newer convention (used in pantry, receipts, dashboard cards) is:

```tsx
<div>
  <h2 className="text-lg font-semibold leading-tight">Listas de compras</h2>
  <p className="text-xs text-muted-foreground">Subtítulo breve.</p>
</div>
```

Avoid `<PageHeader/>` (`src/components/PageHeader.tsx`) for new pages — it predates the current pattern.

---

## Metric strip

Two flavors. Pick by purpose, not page.

### `<StatCard/>` — hero KPI

Use for **money** values that anchor the page (balance, totals, period income/expense). One large currency, optional subtitle. Reference: `src/components/dashboard/StatCard.tsx`.

```tsx
import StatCard from '@/components/dashboard/StatCard';

<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
  <StatCard
    title="Balance total"
    amount={summary.balance}
    iconKey="wallet"
    iconGradient="linear-gradient(135deg, #f97316 0%, #fb923c 100%)"
    subtitle="Saldo en billeteras"
  />
  …
</div>
```

`StatCard` already wraps `formatCurrency`. Available `iconKey` values: `wallet`, `trending-up`, `trending-down`, `circle-dollar`. Add new keys to `ICON_MAP` rather than passing arbitrary icons.

### `<PantryMetricTile/>` — compact tile

Use for **counts, dates, or non-currency** values where you want a smaller footprint and an uppercase micro-label. Reference: `src/components/pantry/PantryMetricTile.tsx`.

```tsx
import { PantryMetricTile } from '@/components/pantry/PantryMetricTile';
import { ListChecks } from 'lucide-react';

<PantryMetricTile icon={ListChecks} label="Carritos en curso" value="3" accent="sky" />
```

Available `accent` keys: `violet`, `blue`, `emerald`, `amber`, `sky`, `slate`.

### Icon gradient palette

Stable semantic mapping — re-use these gradients across pages so users learn the colors:

| Color | Gradient | Used for |
|---|---|---|
| Orange | `135deg, #f97316 → #fb923c` | Wallets, balance |
| Emerald | `135deg, #10b981 → #34d399` | Income, success |
| Violet | `135deg, #8b5cf6 → #a78bfa` | Expenses, receipts |
| Yellow | `135deg, #eab308 → #facc15` | Available, in-progress |
| Sky | `135deg, #0ea5e9 → #38bdf8` | Shopping, planning |
| Blue | `135deg, #3b82f6 → #60a5fa` | Debit, generic |
| Slate | `135deg, #64748b → #94a3b8` | Neutral / archived |
| Rose | `135deg, #f43f5e → #fb7185` | Destructive / canceled |

---

## Card vs table

| Choose | When |
|---|---|
| **`<Card>` + `<DataTable>`** (`wallets`, `expenses`) | Tabular numeric data, sortable columns, ≥ 4 attributes per row |
| **Card grid / list** (`pantry/shopping`) | Heterogeneous items with status pills, primary/secondary actions, mobile-first browsing |
| **Single `<Card>`** | A form, settings panel, or single-record detail |

Don't switch a domain from one to the other without a reason: `pantry/shopping` stays a card grid because each cart has status, totals, and "open" affordances that read better as a card than a row.

---

## Empty state

Use `<EmptyState/>` (`src/components/EmptyState.tsx`) — never roll your own. Centered icon pill + message + optional description + optional action button:

```tsx
<EmptyState
  message="No tienes carritos en este filtro."
  description="Crea una lista para planear tu próxima compra."
  action={{ label: 'Nuevo carrito', onClick: () => setCreateOpen(true) }}
/>
```

For a table that's loaded but filtered to zero, use the table's built-in `emptyMessage` prop instead.

---

## Forms and dialogs

| Pattern | Use |
|---|---|
| `<Sheet side="bottom">` with `rounded-t-2xl` | Mobile-friendly create/edit forms (`CreateCartSheet`) |
| `<Dialog>` | Confirmations, short modal forms |
| `<ConfirmDeleteDialog>` | Always for delete confirmations — never a custom dialog |
| `<Collapsible>` | Optional/advanced fields inside a form |

Form values: validate with Zod schemas from `src/schemas/`, drive with `react-hook-form`. Wire the form's `error` prop back to the same dialog the user is in (don't use a top-level error banner for form errors).

---

## Tailwind tokens cheat sheet

These classes recur across canonical pages. Prefer them over inventing new ones.

### Cards & containers

```
rounded-xl border border-border/60 bg-card shadow-sm
rounded-xl border border-border/60 bg-card p-4 shadow-sm    /* tile */
rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm  /* StatCard */
```

### Borders / dividers

- `border-b border-border/80` — page-level divider (header)
- `border-b border-border/60` — card section divider
- `border-border/40` — subtle inline divider

### Text

- `text-foreground` — primary
- `text-muted-foreground` — secondary
- `text-card-foreground` — body inside a card on tinted backgrounds
- Section title: `text-lg font-semibold leading-tight`
- Subtitle: `text-xs text-muted-foreground`
- Micro-label: `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground`

### Money

Always `font-mono tabular-nums`. Format via `formatCurrency` from `@/lib/utils` — never `Intl.NumberFormat` inline.

```
text-2xl font-bold tracking-tight text-foreground   /* hero KPI */
font-mono tabular-nums text-sm                       /* table cell */
```

### Status colors

Inline semantic classes — keep these consistent so users recognize them:

- Success / paid: `text-emerald-600 dark:text-emerald-400` / `bg-emerald-500/10`
- In-progress / pending: `text-amber-600 dark:text-amber-400` / `bg-amber-500/10`
- Canceled / destructive: `text-destructive` / `bg-destructive/15`
- Info / debit: `text-blue-600 dark:text-blue-400` / `bg-blue-500/10`
- Credit / receipts: `text-violet-600 dark:text-violet-400` / `bg-violet-500/10`

### Buttons

- Primary: default `<Button>` (`h-9` from variant)
- Tall primary on a form: add `h-11`
- Icon-only: `<Button variant="ghost" size="icon">` with `aria-label`
- Mobile FAB: `fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden`
- Desktop primary, hidden on mobile (paired with FAB): `hidden h-9 rounded-xl sm:inline-flex`

### Layouts

- Metric strip: `grid grid-cols-2 gap-4 lg:grid-cols-4`
- Two-column hero: `grid grid-cols-1 gap-4 lg:grid-cols-5` with `lg:col-span-3` / `lg:col-span-2`
- Card list: `flex flex-col gap-4` (was `gap-3` in older code — prefer `gap-4`)
- Filter pills row: `flex gap-2 overflow-x-auto` (no negative margins — let the container handle padding)

---

## Component vocabulary (`src/components/ui/`)

| Component | Use |
|---|---|
| `Card` / `CardContent` | Default container — single card per page section |
| `Button` | Variants: `default`, `outline`, `ghost`, `destructive`. Sizes: `sm`, `default`, `lg`, `icon` |
| `Input` / `Label` / `Form` | Forms — pair with `react-hook-form` |
| `Select` | Dropdown filters. Add `aria-label` on `SelectTrigger` |
| `Badge` | Status pills (variants: `default`, `secondary`, `outline`, `destructive`) |
| `Sheet` | Bottom-slide forms (mobile-first) |
| `Dialog` / `AlertDialog` | Modal confirmations |
| `Tabs` | In-page sub-views (not for primary navigation) |
| `Collapsible` | Optional fields inside forms |
| `DataTable` | Sortable/filterable tables; pass `filterColumn` + `filterPlaceholder` + `filterSlot` |
| `Skeleton` | Loading states inside cards (use a centered `Loader2` only for full-page) |
| `Tooltip` | Auxiliary hints on icon-only buttons |
| `ScrollArea` | Long scrollable lists inside fixed containers |
| `CurrencyInput` | All money inputs — never raw `<Input type="number">` for money |
| `Sidebar` | Owned by layout; do not embed in pages |

---

## Loading and error states

- **Loading (whole page)**: centered `Loader2` with `h-8 w-8 animate-spin` inside `flex justify-center py-12 text-muted-foreground`.
- **Loading (in-card)**: `<Skeleton/>` rows matching the eventual content.
- **Error**: `<Alert variant="destructive">` with `<AlertTitle>` + `<AlertDescription>`. For a top-of-page banner: `mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive`.
- **Toasts** (`sonner`): for transient success/failure of mutations. Don't use toasts to communicate persistent state.

---

## Accessibility checklist (for any new page)

- Every icon-only button has `aria-label`.
- Filter rows use `role="tablist"` / `role="tab"` + `aria-selected` (see `PantryShoppingListView`).
- Status badges include the status word as text, not just color.
- Page section regions have `aria-label` if they're not framed by a heading.

---

## When in doubt

Read these files — they are the source of truth this skill summarizes:

- Layout shell: `src/app/(dashboard)/layout.tsx`
- Hero KPI: `src/components/dashboard/StatCard.tsx`
- Compact tile: `src/components/pantry/PantryMetricTile.tsx`
- Empty state: `src/components/EmptyState.tsx`
- Action-bar reference: `src/app/(dashboard)/wallets/page.tsx`
- Metric-strip reference: `src/app/(dashboard)/dashboard/page.tsx`
- Card-grid list reference: `src/components/pantry/PantryShoppingListView.tsx`
- Currency util: `formatCurrency` in `src/lib/utils.ts`
