---
name: dashboard-ui
description: Canonical layout, components, spacing and color conventions for MiCasa app pages (Next.js 16 App Router + Tailwind v4 + Radix/shadcn). Use when creating or redesigning any page under `src/app/(app)/**`.
when_to_use:
  - Creating a new app page under `src/app/(app)/`
  - Redesigning or polishing an existing app page
  - Adding a metric strip / KPI cards
  - Choosing between Card grid and DataTable for a list view
  - Picking icon gradients, spacing, or border tokens
---

# MiCasa App UI

This skill encodes the conventions already established by the canonical pages: `monthly/[year]/[month]/page.tsx`, `wallets/page.tsx`, `expenses/`, and `credit-cards/`. New pages should match this dialect; existing divergent pages should be aligned with it (not the other way around).

**Visual language** (navy canvas, glass, orange CTAs, blue→magenta): [`DESIGN.md`](../../../DESIGN.md). Do not commit third-party mockups. Tokens live in `src/app/globals.css` (`.dark`). Default theme is dark.

The app frame (sidebar, sticky header, `AppAtmosphere`, container) is owned by `src/app/(app)/layout.tsx`. **Pages render only their content** — do not re-wrap in another container or set their own background.

---

## Page anatomy

The layout already provides:

```tsx
<div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col gap-4 bg-background p-6">
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
<div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-border/60 bg-background py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
  <Button variant="outline" asChild>…</Button>
  <Button onClick={…}>…</Button>
</div>
```

Match `(app)/layout.tsx`: the shell header is **`h-16`** (`4rem`). Sticky page chrome must use **`top-16`** (not `top-20`) so no scrolled content appears in the strip between the shell header and this bar. When the sidebar is **icon-collapsed**, the header becomes **`h-12`** — add **`group-has-data-[collapsible=icon]/sidebar-wrapper:top-12`** (same pattern as `wallets/page.tsx`). Prefer opaque **`bg-background`** (and optional `border-b`) over semi-transparent + blur for the same reason.

If the page has both a title and an action, use **justify-between** instead of justify-end so the title sits on the left.

### Page title pattern

Inline title + subtitle, not the legacy `<PageHeader/>` with `text-3xl`. The newer convention (used in wallets, loans, dashboard cards) is:

```tsx
<div>
  <h2 className="text-lg font-semibold leading-tight">Billeteras</h2>
  <p className="text-xs text-muted-foreground">Subtítulo breve.</p>
</div>
```

Avoid `<PageHeader/>` (`src/components/PageHeader.tsx`) for new pages — it predates the current pattern.

---

## Metric strip

Two flavors. Pick by purpose, not page.

### `<StatCard/>` — hero KPI

Use for **money** values that anchor the page (balance, totals, period income/expense). One large currency, optional subtitle. Reference: `src/components/StatCard.tsx`.

```tsx
import StatCard from '@/components/StatCard';

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

### Metric strip (compact non-currency)

Use for **counts, dates, or non-currency** values with a calm shell and colored left border. Prefer `METRIC_STRIP_CLASS` from `src/components/ui/metric-strip.ts` plus a `border-l-*` accent (see fintech / UI consistency rules).

```tsx
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { cn } from '@/lib/utils';

<div className={cn(METRIC_STRIP_CLASS, 'border-l-sky-500/50')}>
  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
    Préstamos activos
  </span>
  <span className="text-sm font-bold font-mono tabular-nums">3</span>
</div>
```

### Icon gradient palette

Stable semantic mapping — re-use these gradients across pages so users learn the colors:

| Color | Gradient | Used for |
|---|---|---|
| Orange CTA | `135deg, #FF5733 → #FF2E00` | Primary buttons in dark (use `<Button>`, do not duplicate) |
| Electric blue | `135deg, #3a37fc → #911efe` | Brand, debit, selected, icon pills |
| Pink / magenta | `135deg, #ee477a → #cf1ae6` | Accent, mark gradient end |
| Emerald | `135deg, #10b981 → #34d399` | Income, success |
| Violet | `135deg, #8b5cf6 → #a78bfa` | Expenses, receipts |
| Amber | `135deg, #eab308 → #facc15` | Pending, in-progress |
| Sky | `135deg, #0ea5e9 → #38bdf8` | Planning |
| Slate | `135deg, #64748b → #94a3b8` | Neutral / archived |
| Rose | `135deg, #f43f5e → #fb7185` | Destructive / canceled |

---

## Card vs table

| Choose | When |
|---|---|
| **`<Card>` + `<DataTable>`** (`wallets`, `expenses`) | Tabular numeric data, sortable columns, ≥ 4 attributes per row |
| **Card grid / list** (`loans`, credit-card import history) | Heterogeneous items with status pills, primary/secondary actions, mobile-first browsing |
| **Single `<Card>`** | A form, settings panel, or single-record detail |

Don't switch a domain from one to the other without a reason: keep card grids when each item has status, totals, and "open" affordances that read better as a card than a row.

---

## Empty state

Use `<EmptyState/>` (`src/components/EmptyState.tsx`) — never roll your own. Centered icon pill + message + optional description + optional action button:

```tsx
<EmptyState
  message="No tienes préstamos activos."
  description="Registra un préstamo para seguir el calendario de pagos."
  action={{ label: 'Nuevo préstamo', onClick: () => setCreateOpen(true) }}
/>
```

For a table that's loaded but filtered to zero, use the table's built-in `emptyMessage` prop instead.

---

## Forms and dialogs

| Pattern | Use |
|---|---|
| `<Sheet side="bottom">` with `rounded-t-2xl` | Mobile-friendly create/edit forms |
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
rounded-2xl border border-border/60 bg-card shadow-sm dark:border-white/[0.08] dark:bg-[#0d1327]/80 dark:backdrop-blur-xl
  /* planner glass — prefer MONTHLY_PANEL_SHELL_CLASS */
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

- Primary: default `<Button>` — in dark this is the orange gradient (`#FF5733` → `#FF2E00`). `--primary` remains electric blue for selection / icon pills / toggles.
- Tall primary on a form: add `h-11`
- Icon-only: `<Button variant="ghost" size="icon">` with `aria-label`
- Mobile FAB: `fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden`
- Desktop primary, hidden on mobile (paired with FAB): `hidden h-9 rounded-xl sm:inline-flex`
- Landing-only pills: `.landing-cta` + `rounded-full` — do not use on app routes

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
- Filter rows use `role="tablist"` / `role="tab"` + `aria-selected` when presenting segmented filters.
- Status badges include the status word as text, not just color.
- Page section regions have `aria-label` if they're not framed by a heading.

---

## When in doubt

Read these files — they are the source of truth this skill summarizes:

- Visual contract: `DESIGN.md`
- Tokens: `src/app/globals.css` (`.dark`, `.landing-root`)
- Layout shell: `src/app/(app)/layout.tsx`
- Glass panel: `src/components/monthly/monthly-panel-shell.ts`
- Hero KPI: `src/components/StatCard.tsx`
- Metric strip constant: `src/components/ui/metric-strip.ts`
- Empty state: `src/components/EmptyState.tsx`
- Action-bar reference: `src/app/(app)/wallets/page.tsx`
- Metric-strip reference: `src/app/(app)/monthly/[year]/[month]/page.tsx`
- Card-grid list reference: `src/app/(app)/loans/page.tsx`
- Currency util: `formatCurrency` in `src/lib/utils.ts`
