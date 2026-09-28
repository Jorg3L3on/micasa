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

**Visual language** (navy canvas, glass, electric-blue CTAs, blue→magenta): [`DESIGN.md`](../../../DESIGN.md). Do not commit third-party mockups. Tokens live in `src/app/globals.css` (`.dark`). Default theme is dark.

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
  {/* Metric strip (optional) */}
  {/* Primary card / table / grid */}
  {/* Secondary content (charts, side panels) */}
</div>
```

Page rhythm is always `space-y-5`.

### Archetypes

Pick one before building (full contract in `DESIGN.md` → **Logged-in UI contract**):

| Archetype | Routes | Notes |
|---|---|---|
| **Planner** | Panel financiero, quincena (deep links only) | Period controls in-page (glass band with month + icon prev/next). Glass via `MONTHLY_PANEL_SHELL_CLASS` |
| **Collection** | Billeteras, Metas, Préstamos, Operaciones, Presupuestos | One create action in the header; search/filters in the header |
| **Detail** | Billetera, estado de cuenta, meta | Back to its collection; card faces stay solid |
| **Settings** | Configuración | Calm `bg-card` cards, never glass; section nav (side list desktop, chips mobile) |

### Toolbar-first chrome

The app header owns the **route title, search, filters, and the one primary action**. Pages register them — they do not render their own title or sticky action bar:

```tsx
import { useRegisterToolbarActions } from '@/context/toolbar-actions-context';

useRegisterToolbarActions({
  primaryAction: { label: 'Nueva billetera', onClick: handleOpenCreate, icon: <Plus className="h-4 w-4" /> },
  search: { value: query, onChange: setQuery, placeholder: 'Buscar billetera' },
  filters: { open: filtersOpen, onOpenChange: setFiltersOpen, activeCount },
  overflow: { items: [{ key: 'import', label: 'Importar', onClick: handleImport }] },
});
```

Render filter fields with `<ToolbarFiltersPortal>`. Rare actions go in `overflow` (or `useRegisterToolbarOverflow` for nested pages).

**Do not:**

- Repeat the header title with an in-page `h1`/`h2` heading or subtitle.
- Add an in-page `sticky top-16` action bar.
- Use `<PageHeader/>` (`src/components/PageHeader.tsx`) — it is unused legacy.

The planner's month name inside its glass band is the period control, not a second title — keep it.

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
  <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
    Préstamos activos
  </span>
  <span className="text-sm font-bold font-mono tabular-nums">3</span>
</div>
```

### Icon gradient palette

Stable semantic mapping — re-use these gradients across pages so users learn the colors:

| Color | Gradient | Used for |
|---|---|---|
| Electric blue CTA | `#3a37fc` + violet ring | Primary buttons in-app (use `<Button>`, do not duplicate) |
| Orange CTA | `135deg, #FF5733 → #FF2E00` | Landing `.landing-cta` only |
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
| `<ResponsiveOverlay>` (`src/components/overlay/responsive-overlay.tsx`) | **Every** multi-field create/edit: centered Dialog `md+`, bottom Sheet below. Header Cancelar left, centered title, `sr-only` description, one full-width primary (`h-11 w-full rounded-xl`), no footer Cancelar. Never hand-roll `isMobile ? <Sheet> : <Dialog>` |
| `<ConfirmDeleteDialog>` | Always for delete confirmations — same on both breakpoints, never a custom dialog |
| `<Collapsible>` | Optional/advanced fields inside a form |

Portaled selects inside an overlay call `useOverlaySelectOpenChange()` so closing the list does not dismiss the sheet.

### Delete

Viewport rule: below `md` swipe-to-delete only (hide the trash); `md+` quiet trash icon, no swipe. Both confirm with `ConfirmDeleteDialog`. Reference: `src/components/categories/CategoryTreeRow.tsx` + `SwipeDeleteAction`.

### Motion

Only the allow-list in `DESIGN.md` (currency ticker on hero totals, motion tabs for 2–3 in-page views, mobile pull to refresh on planner + collections, morph on billeteras/tarjetas, swipe delete below `md`). Use tokens: `duration-(--motion-panel) ease-(--ease-out-soft)`, `.motion-fade-in`, `.motion-slide-up`. Always honor reduced motion.

Form values: validate with Zod schemas from `src/schemas/`, drive with `react-hook-form`. Wire the form's `error` prop back to the same dialog the user is in (don't use a top-level error banner for form errors).

---

## Tailwind tokens cheat sheet

These classes recur across canonical pages. Prefer them over inventing new ones.

### Cards & containers

```
rounded-xl border border-border/60 bg-card shadow-sm
rounded-2xl border border-border/60 orion-panel-glass dark:border-white/[0.12] dark:backdrop-blur-2xl
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
- Micro-label: `text-caption font-semibold uppercase tracking-wider text-muted-foreground` (11px minimum; `text-caption`)

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
- Info / debit: `text-primary-text` / `bg-blue-500/10`
- Credit / receipts: `text-violet-600 dark:text-violet-300` / `bg-violet-500/10`

### Buttons

- Primary: default `<Button>` — in dark this is electric blue (`#3a37fc`) with a violet ring. `--primary` is that fill, plus selection / icon-pill fills / toggles. Brand copy on navy (dates, links, Cancelar): `text-primary-text`.
- Tall primary on a form: add `h-11`
- Icon-only: `<Button variant="ghost" size="icon">` with `aria-label`
- Page primary action: register it in the app header (`primaryAction`), not as an in-page button or FAB
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
- Toolbar registration: `src/context/toolbar-actions-context.tsx` (reference page: `src/app/(app)/wallets/page.tsx`)
- Responsive overlay: `src/components/overlay/responsive-overlay.tsx`
- Metric-strip reference: `src/app/(app)/monthly/[year]/[month]/page.tsx`
- Card-grid list reference: `src/app/(app)/loans/page.tsx`
- Currency util: `formatCurrency` in `src/lib/utils.ts`
