# Plan: Billeteras web master-detail layout

Status: draft for Rafael's review. Planning only, no app code changed.
Scope: `/wallets` at `md`+ (web). Mobile keeps the current behavior. Branch `claude/project-thread-qsq4iz` from `sandbox`.
Assumed answers (defaults, change if wrong): replaces the web cover-flow from `plans/wallets-list-redesign-spec.md`; detail renders inline; toolbar filters and presets stay; left list grouped by type with a total.

## 1. Reference and research
Reference image (Solcard-style): left rail with a list of cards (thumbnail, name, subtitle, selected row highlighted, "+" create row), right pane with a small breadcrumb line, a huge balance with muted decimals, a primary pill plus secondary pill plus overflow, and a transaction table of rounded rows with status chips.
Patterns seen across banking and fintech web apps (Revolut, Monzo, Mercury account switchers, wallet UI kits): the list is a stable navigation rail (selection never reloads the page, URL reflects the selection), the hero number is the only large type, actions sit directly under it, and the history is a list of rows rather than a heavy table. Web search results were thin (mostly Dribbble and UI-kit listings), so these are patterns I'm confident about, not citations.
What we borrow: persistent list plus inline detail, hero balance with muted decimals, pill actions, row-style transactions, a create row at the end of the list.
What we do not borrow: Solcard's near-black canvas and neon status text (we use Orion tokens), per-card artwork (we use the shared wallet face as a small thumbnail).

## 2. Fit with the design system (DESIGN.md)
- Archetype: Collection (list) with the Detail content embedded. No in-page title (header owns it); page rhythm `space-y-5`.
- Surfaces: left rail and right pane are calm `bg-card` panels with `border-border`, `rounded-2xl`, `shadow-panel`. No glass (glass is planner-only), no grid overlay, no gradient KPI fills.
- Money: shared `Money`, tabular numerals. Hero balance `text-5xl font-semibold`, cents in `text-muted-foreground`. Credit wallets show "Usado" as hero with "Disponible" beneath.
- Buttons: shared `Button`, `rounded-xl`; primary uses `variant="default"` (electric blue), secondary `variant="outline"`, overflow `ghost icon`.
- Status: tokens `overdue`, `pending`, `info`, emerald for paid; chips reuse existing badge styles.
- Create: stays the header icon button (`PAGE_CREATE_ACTION.wallet`); the list also ends with a quiet "Agregar billetera" row.
- Motion: allow-list only (selection crossfade of the right pane, 150 ms; reduced motion = none).

## 3. Layout (web, 1280px)
```
┌ toolbar: Billeteras           [search] [filters] [+] ─────────────────────┐
│ ┌ Lista (360px) ──────────────┐ ┌ Detalle ─────────────────────────────┐ │
│ │ Liquidez total   $48,210.40 │ │ Débito · BBVA *5177   [Activa] [⤢]   │ │
│ │ Deuda tarjetas   $12,300.00 │ │                                      │ │
│ │ ─ Efectivo y débito ─────── │ │ $7,115.23                            │ │
│ │ ▣ Cuenta BBVA   $7,115.23 ◀ │ │ Disponible en liquidez $7,115.23     │ │
│ │ ▣ Efectivo        $820.00   │ │                                      │ │
│ │ ─ Tarjetas de crédito ───── │ │ [Transferir] [Registrar ingreso] [⋯] │ │
│ │ ▣ Mercado Pago  -$4,300.00  │ │                                      │ │
│ │   vence en 3 días ●         │ │ Resumen  Usado · Disponible · Corte  │ │
│ │ ▣ Liverpool     -$1,950.00  │ │ ──────────────────────────────────── │ │
│ │ ＋ Agregar billetera        │ │ Movimientos      [Todos|Ing|Egr] [🔍]│ │
│ └─────────────────────────────┘ │ ◉ Café            -$85   hoy         │ │
│                                 │ ◉ Nómina       +$12,000  1 nov       │ │
│                                 └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```
Left list (sticky, own scroll): 
- Header totals: Liquidez total, Deuda en tarjetas (compact, from existing `summarizeWallets`).
- Two sections (reuse `groupWalletsBySection`), empty sections hidden.
- Row: 40px `WalletCardFace` thumbnail (type colour, last digits), name, subtitle (type, issuer), amount right-aligned, an attention dot with caption for due-soon cards (reuse `buildAttentionItems`).
- Selected row: `bg-accent` fill plus a 2px `bg-primary` left bar; inactive wallets muted with "Inactiva"; frozen/disabled shown like the reference's snowflake row.
Right pane:
- Meta line: type and last digits, status chip, bookmark/favourite is not included (no data for it).
- Hero balance, one muted caption line.
- Actions: reuse existing dialogs: Transferir, Registrar ingreso (credit: Registrar pago / Comprar per `useWalletQuickActions`), Ajustar saldo, plus "⋯" menu with Editar, Importar, Historial, Eliminar (existing delete confirm).
- Summary block by type (existing `WalletDetailSections`): funding vs credit usage, cycle, planned payment.
- Movimientos: embed `WalletMovementsFeed` as rows grouped by date (it already supports it), with a "Ver todo" link to `/wallets/[id]`.
Widths: `md` 768-1023: list collapses to 280px and the summary block stacks under the hero; `lg`+: 360px list and a fluid right pane (max 880px).

## 4. Behavior
- Selection lives in the URL (`/wallets?w=<id>`) so refresh and back/forward work; default is the first wallet in sort order. Filtering that hides the selected wallet selects the first match.
- Keyboard: up/down moves selection in the list (roving tabindex, `aria-current`), Enter focuses the pane.
- Data: list from the existing wallet-list fetch and cache; detail fetched per selection using the existing detail and movements endpoints plus the `wallet-detail-prefetch` warm cache (prefetch on row hover/focus). No new API.
- Dialogs refetch the list and the selected detail after success (no reload).
- `/wallets/[id]` stays for deep links, mobile, and "open full page".

## 5. States
Loading: skeleton with list rows plus hero and rows (extend `WalletsListSkeleton`). Empty (no wallets): single centered `EmptyState` with the create button. No filter matches: `EmptyState` in the list with "Limpiar filtros", right pane shows "Selecciona una billetera". Detail error: `ErrorBanner` with Reintentar inside the pane only.

## 6. Mobile (<md)
Unchanged in this PR: existing deck/flow and navigation to `/wallets/[id]`. A follow-up can reuse the same row component as a plain list.

## 7. Implementation tasks
1. `WalletListRow` and `WalletsMasterList` (sections, totals, selection, keyboard).
2. Extract the detail body from `wallets/[id]/page.tsx` into `WalletDetailPane` (shared by the route and the inline pane) with `WalletHeroBalance`.
3. `WalletsMasterDetail` wrapper at `md`+, URL selection, wire dialogs and reload.
4. Skeleton, empty and error states.
5. Remove the web cover-flow code paths no longer used; keep mobile ones.
6. DESIGN.md: Billeteras web = master-detail, calm panels, no glass.
7. Tests: selection and fallback logic, hero money split. Run lint, test, build; screenshots at 1280, 1024, 768, 390.

## 8. Acceptance
Web shows list plus inline detail matching the mockup; selection persists in the URL; all actions work without reload; tokens only (no `rounded-[..]`, `shadow-[..]`, glass, gradients); mobile unchanged; `npm run lint`, `npm test`, `npm run build` pass.

## 9. Open questions (defaults in bold)
- Q1 Remove web cover-flow entirely? **Yes.**
- Q2 Hero for credit cards: **Usado**, with Disponible beneath.
- Q3 Include a balance sparkline in the hero? **No (not in the reference, no data endpoint).**
- Q4 Movements: **last 20 in-pane plus "Ver todo".**
