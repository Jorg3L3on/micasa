# MiCasa design system

Encode the UI in **tokens, recipes, and live screenshots of this codebase**. Do **not** commit third-party mockups or chat-attached reference images. Humans and agents should apply this file (plus the CSS tokens) when building or restyling screens.

**Canonical live surfaces** (match these, then roll the same language to other pages):

| Surface | Route | Code |
| --- | --- | --- |
| Marketing landing | `/` | `src/components/landing/*`. Same Geist + Manrope and light/dark theme as the app. |
| Login | `/login` | `src/components/login/*` |
| Panel financiero | `/monthly/{year}/{month}` | `src/components/monthly/*`, `src/app/(app)/monthly/` |

Runtime tokens live in `src/app/globals.css` (`.dark` for the app, `.landing-root` for marketing). Default theme is **dark** (`ThemeProvider` `defaultTheme="dark"`). **Light mode is a supported secondary theme** (toggle / `d` hotkey); new work must look correct in **both**, with dark still the primary product look.

Agent entry points:

- This file (`DESIGN.md`) — visual contract
- `.cursor/rules/fintech-ui-design-system.mdc` — cards, metrics, money type
- `.cursor/rules/ui-consistency.mdc` — chrome, CTAs, hierarchy (always on)
- `.cursor/rules/responsive-overlays.mdc` — Dialog/Sheet overlays (always on); points to **Overlays** below
- `.claude/skills/dashboard-ui/SKILL.md` (same copy in `.agents/skills/dashboard-ui/`) — page anatomy
- Overlay builds and migrations: `.claude/skills/responsive-overlay/SKILL.md` (`/responsive-overlay`)

---

## Visual contract

Navy canvas, glass cards, **electric-blue primaries**, **blue → magenta** accents. Primary actions use the shared `Button`. Atmosphere is soft blurred orbs, not busy illustration.

| Role | Hex | CSS / class |
| --- | --- | --- |
| Canvas | `#060914` | `--background` (dark) |
| Surface / sidebar | `#090e1d` | `--secondary`, `--sidebar` |
| Card | `#0d1327` | `--card` |
| Muted chip | `#12183a` | `--muted`, `--accent` |
| Text | `#f7f8ff` | `--foreground` |
| Muted text | `#9ca3af` | `--muted-foreground` |
| Electric blue (primary, brand) | `#3a37fc` | `--primary`, `--chart-1` |
| Primary text (on canvas) | `#f7f8ff` (dark, same as text) | `--primary-text`, `text-primary-text` |
| Violet glow / ring | `#911efe` | `--ring`, `--chart-4` (dark) |
| Pink | `#ee477a` | `--chart-2` (dark) |
| In-app and landing primary button | `#3a37fc` + violet ring | `Button` `variant="default"` |
| Hairline | `rgb(255 255 255 / 0.08–0.1)` | `--border`, `dark:border-white/[0.08]` |
| Success / paid | emerald (`#34d399`, `emerald-400`) | `--chart-3` |
| Danger | destructive token | `--destructive` |

Brand mark (`MicasaMark`): display the optimized `public/brand/mark-160.png` through `next/image`. Do not redraw it. Icon scripts still read the source `public/brand/mark.png` and plate it on navy `#060914`. Route progress (`NextTopLoader`): `#3a37fc`.

Palette swatch (SVG, not a screenshot): [`docs/images/orion-tokens.svg`](docs/images/orion-tokens.svg).

---

## Two surfaces

### Marketing landing (`/`)

The landing follows the signed-in theme. `ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem`) wraps the root layout, and the landing uses the same `--background`, `--card`, `--foreground`, type scale, `Button`, and `<Money>` as the app. Light is a working theme here, not a dark-only exception.

- **Fonts:** Geist for body, Manrope for `h1`–`h3`. No Nunito and no landing-only font variables.
- **Type scale:** `text-display`, `text-title`, `text-section`, `text-body`, `text-caption`, `eyebrow`. Nothing smaller than caption.
- **Canvas:** `bg-background`. `LandingAtmosphere` orbs use `color-mix` of `--primary`, `--chart-2`, and `--chart-4`. Loops run only under `prefers-reduced-motion: no-preference`. No pointer spotlight, parallax, or magnetic controls.
- **Hero:** `.landing-hero-wash` is a marketing-only wash built from those tokens and `--shadow-panel`. One primary `Button` (`Crear cuenta`); the second action is `ghost`.
- **Product:** real screenshots in `public/landing/` (`next/image`, webp), desktop and mobile, light and dark. There is no pricing section — the product has no paid plans; copy may say it is free to use. Statement import is described as a file the user brings, not a bank connection.
- **Quincena block:** normal document flow below `md` and whenever reduced motion is on. From `md` up, with motion allowed, the pair sits in a 140vh sticky stage.
- **Money** on the landing uses `<Money>` / `formatCurrency` (sans, tabular). Status chips use `src/lib/status-tone.ts`.

### Logged-in app (and login)

- **Fonts:** Geist + Geist Mono for body/UI; **Manrope** (`--font-display`) for `h1`–`h3` and brand lockup. Money uses `<Money>` (sans, tabular).
- **Same navy tokens** as landing (`.dark` in `globals.css`).
- **`--primary` is electric blue** — icon pills, focus rings, toggle ON, active nav, semantic “selected”.
- **`--primary-text` (`text-primary-text`)** — dates, links, Cancelar, and money accents on the canvas. In dark this matches `--foreground` (`#f7f8ff`). Do not use `text-primary` for small copy on navy; `#3a37fc` is a fill color and is too dark to read.
- **Primary labeled buttons** use **electric blue** (`#3a37fc` in dark) with a violet ring (`Button` `variant="default"`), including the landing. Do not invent a second primary fill.
- **Atmosphere:** `AppAtmosphere` in `(app)/layout.tsx` (blue / pink / violet blurs). Login has its own aurora (`login-stage`).
- **Glass shells:** `MONTHLY_PANEL_SHELL_CLASS` in `src/components/monthly/monthly-panel-shell.ts` (adds `.orion-panel-glass`). Reuse it for planner chrome, summaries, and similar panels — do not invent a new glass recipe per page. Do **not** put a grid overlay on these cards.

```
orion-panel-glass relative rounded-2xl border border-border/60
dark:border-white/[0.12] dark:backdrop-blur-2xl dark:backdrop-saturate-120
```

Dark glass is even translucent navy (`#090e1d` at ~52%) with a luminous hairline and a floating blue-black shadow so atmosphere shows through. Do **not** put a grid overlay or corner sheen on these cards. Summary metrics sit on the panel without nested cards.

**Wallet strip exception (Panel financiero only):** `WalletBalanceStrip` has no panel of its own; each card face carries a Magic UI `AnimatedGridPattern` (`src/components/ui/animated-grid-pattern.tsx`) with brand-tinted squares. Cards use provider tone `aura` (deep face + brand bloom), a brand-colored `ShineBorder` (`src/components/ui/shine-border.tsx`), and a blurred brand halo from `getWalletAuraColors()`. Keep this treatment scoped to the strip; glass panels stay grid-free.

**Aura language (Panel financiero / planner):** the rest of the planner echoes the strip at lower intensity through one shared kit — `AuraSurface` (`src/components/aura/aura-surface.tsx`) and `src/lib/ui/aura-palette.ts` (`AURA_TONE_HEX`, `getAuraWalletColor`, `getAuraBloomImage`, `getAuraBarStyle`). Do not hand-roll blooms or glows.

- **Animated** (`animated`): only the Resumen hero tiles (Balance actual / Liquidez actual) — emerald when healthy, destructive when negative.
- **Static** `AuraSurface`: remainder strip (emerald / amber / destructive) and budget allocation tiles (wallet brand, violet fallback).
- **Gastos / Tarjetas / Préstamos rows:** one shell (`MONTHLY_PANEL_SHELL_CLASS`) plus `AuraRowBloom`, no left accent bar and no tinted gradient fills. Hue comes from `getDueRowTone` in `aura-palette.ts`: pagado emerald, vencido destructive, vence en ≤7 días or falta dato amber, más adelante blue, sin cargo / cancelado neutral. Open rows get a stronger wash, paid rows dim. Wallet label is a neutral chip; the provider icon carries wallet identity.
- **Bars:** budget fills use `getAuraBarStyle`; the quincena progress is electric blue → violet with a glow (tracks are not `overflow-hidden` so the glow shows).
- **Tabs:** planner tab groups use `AURA_TAB_INDICATOR_CLASS` (glass pill + `.liquid-glass-pill-aura` halo).

Sticky header: `bg-background/85 backdrop-blur-xl` and in dark `dark:bg-[#060914]/55` plus saturate so atmosphere shows through the chrome.

---

## Logged-in UI contract

Panel financiero is the reference for **tokens, glass, overlay chrome, and operate motion** — not a layout to paste onto Configuración or onto wallet and goal card faces. These decisions are locked; do not invent a second pattern. F1 and F2 live in **Glossary**, **Fintech data UI**, **Filters**, **Surfaces**, **Empty, error, and loading**, and **Chrome**. F3 screen choices (Operaciones as a mobile list, Billeteras rows vs desktop faces, Alertas, onboarding, one mobile plus) are in **Surfaces** and **Chrome**.

### Page archetypes

Every logged-in route is one of four archetypes:

| Archetype | Purpose | Routes | Surface |
| --- | --- | --- | --- |
| **Planner** | Plan a period; period controls live in the page | Panel financiero (`/monthly/…`), Análisis (Liquidez / Plan), quincena (`/fortnight/…`, deep links only) | Glass via `MONTHLY_PANEL_SHELL_CLASS` |
| **Collection** | Scan and filter many records, one create action | Billeteras, Metas, Préstamos, Operaciones, Presupuestos | Calm cards / tables; glass only via the planner shell. Operaciones below `md` is a row list, not a table |
| **Detail** | One object, back to its collection | Billetera, estado de cuenta (tarjeta), meta | Same as collection; card faces stay solid |
| **Settings** | Quiet catalogs and account | Configuración (cuenta, categorías, plantillas, usuarios, conexiones) | Calm `bg-card` cards — **never** glass |

The quincena route stays for deep links and adopts planner chrome. It is **not** in the sidebar or the mobile dock.

### Chrome (toolbar-first)

- The **app header** owns the route title, search, filters, and the **one primary action** — register them with `useRegisterToolbarActions` (`src/context/toolbar-actions-context.tsx`). Rare actions go in the header overflow (`overflow` / `useRegisterToolbarOverflow`).
- **Create actions.** From `md` up, the primary action is a labeled button (`Agregar …`, or the action’s own verb such as `Ahorrar`). Below `md`, the dock’s central **+** is the only floating action. Page create actions whose label starts with **Agregar** are not a second **+**; they live in the header **Más** menu. Other primaries stay an icon button on small screens.
- Do **not** repeat the header title with an in-page heading. Do **not** add an in-page sticky action bar.
- Page rhythm under the header is **`space-y-5`**.
- The month name in the planner glass band stays — that band is the period control, not a second page title.
- Glass uses the single planner shell. Wallet and goal card faces stay solid. Do not glass-wash Configuración.
- Do not put a grid or a tinted wash on glass panels.

### Mobile map

- **Dock** stays five slots: **Panel**, **Billeteras**, **Análisis**, the **plus** button, **Más**.
- The third tab is labeled **Análisis** and opens the same page as the sidebar item **Análisis**.
- **Más** opens the sidebar sheet.
- **Sidebar order** (canonical): Panel financiero, Billeteras, Préstamos, Análisis, Metas, Operaciones, then Configuración (Presupuestos lives under Configuración). Configuración is in that list **and** stays in the team switcher.
- The active dock label uses readable foreground text (`text-foreground`), not the electric-blue fill color.

### Motion allow-list

Tokens first (see **Motion tokens**). Dialog and sheet open/close use `--motion-panel` + `--ease-out-soft`. Operate motion stays ≤ 320ms. Honor `prefers-reduced-motion` everywhere.

Apply **only**:

| Motion | Where |
| --- | --- |
| Currency ticker | Hero money amounts (planner summary, liquidez hero, préstamos / metas / presupuestos totals). **Not** table cells or list rows |
| Motion tabs | In-page choice of two or three views (quincena toggle, Presupuestos vs Plantillas, budget status views) |
| Pull to refresh (mobile only) | Planner, Billeteras, Metas, Préstamos, Operaciones, Análisis, and Presupuestos. The rest of Configuración (cuenta, categorías, plantillas, usuarios, conexiones) does not pull to refresh |
| Shared-element morph | Billeteras and tarjetas only. Do not add one for metas or préstamos |
| Swipe to delete | Below `md` only, then `ConfirmDeleteDialog` (see **Viewport delete**). Billeteras, metas, préstamos, plantillas, categorías, expense rows |

Planner-only (do not copy elsewhere): the fortnight progress knob, the bouncy summary accordion, and the animated summary badge.

### Out of scope

Login, admin, the tasks route, and OAuth consent keep their own surfaces. The marketing landing uses the shared `Button` and the same light and dark tokens as the app.

---

## Layout and controls

Keep chrome **sparse**. One dominant labeled control per block; rare actions in `DropdownMenu`.

1. **Chrome row** — month / owner / prev-next as icon + Spanish `Tooltip`. No strip of equal-weight buttons.
2. **Content row** — wide data (wallet chips, KPI strips) full width **below** chrome, not squeezed beside nav icons.
3. **Primary work** — the repeated action (add expense, pay, etc.) sits next to the data it changes.

Tertiary view controls: `Button variant="ghost"` at `h-8`–`h-9`. Stronger secondary: `outline` + `rounded-xl`. Default buttons, including landing CTAs, use the shared `Button` radius (`rounded-xl`) unless the control is a pill toggle (quincena).

Icon-only: always `aria-label` + usually `Tooltip` in Spanish.

Binary preferences: `Toggle` / `ToggleField` (`src/components/ui/toggle.tsx`). ON = `bg-primary` (electric blue). Checkbox only for multi-select.

### Viewport delete

List/card delete is viewport-split (`md` = 768px):

- **`md+`:** quiet trash icon (`hidden md:inline-flex`), no swipe.
- **Below `md`:** swipe-to-delete only (`swipeEnabled={isMobile}`); hide the trash icon.

Shared row wrapper: `SwipeDeleteRow` (`src/components/ui/swipe-delete-row.tsx`) around the trailing control `SwipeDeleteAction`; tables opt in with `DataTable` `renderMobileRow`. Confirm with `ConfirmDeleteDialog`. Reference: `src/components/categories/CategoryTreeRow.tsx`. Shared swipe thresholds: `src/lib/ui/swipe-delete.ts`.

### Form actions (Save / Cancelar / Cerrar / X)

| Situation | Pattern |
| --- | --- |
| **Responsive form overlay** (Dialog + Sheet) | Header **Cancelar** (`ghost` + `text-primary-text`, left) replaces the top-right **X**. Centered title. No footer Cancelar. One full-width primary (`h-11 w-full rounded-xl`). At most one dismiss and one primary — no duplicate Cancelar/Guardar. |
| Page / non-overlay forms | Footer **Cancelar** (`outline`) + primary (**Guardar** / **Crear** / …); optional header **X** whose `sr-only` label is **Cerrar** |
| Read-only / done / import result | Footer **Cerrar** only (or X alone) |
| Confirm (delete, archive, "continuar de todos modos") | `ConfirmDeleteDialog` (`tone="destructive"` default, `tone="default"` for non-destructive) — header **Cancelar** + one full-width confirm, on the shared overlay |

Rules:

- Overlay chrome and body match **Agregar gasto** (`src/components/quick-capture/QuickExpenseSheet.tsx`). See **Overlays** for the full spec.
- Loading copy uses the ellipsis character: `Guardando…` / `Eliminando…` / `Creando…`.
- Destructive confirms use a destructive primary; do not invent a second Cancelar in the footer of an overlay that already has header Cancelar.

### Motion tokens

CSS variables in `globals.css` (respect `prefers-reduced-motion`):

| Token | Value | Use |
| --- | --- | --- |
| `--motion-fast` | 120ms | Press / toggle feedback |
| `--motion-base` | 200ms | Routine state / route fade |
| `--motion-panel` | 320ms | Dialog / sheet open-close |
| `--ease-out-soft` | cubic-bezier(0.22, 1, 0.36, 1) | Continuity |
| `--ease-spring` | cubic-bezier(0.16, 1, 0.3, 1) | Snappy micro feedback |

Utilities: `.motion-fade-in` (`--motion-base`) and `.motion-slide-up` (`--motion-panel`); both are disabled under reduced motion. Tailwind usage: `duration-(--motion-panel) ease-(--ease-out-soft) motion-reduce:animate-none` (as in `src/components/ui/dialog.tsx` / `sheet.tsx`). Route transitions use View Transitions + a short mobile page settle. Operate surfaces stay ≤ 320ms; no scroll-reveal theater on the planner. What may animate is fixed by the **Motion allow-list** above.

### Light mode inventory (known gaps)

Fix these when touching light parity (do not leave new hardcoded dark-only chrome):

- Settings income/expense template inputs: use `TEMPLATE_FIELD_SHELL_CLASS` (theme-aware); avoid raw `border-white/15 bg-black/35`
- Glass / monthly shells: light uses `--shadow-card`; dark keeps Orion glass under `dark:`
- Primary `Button`: `--primary` fill in both themes (electric blue in `.dark`), on the landing and in the app
- Landing follows the same light and dark theme as the app (`ThemeProvider` on the root layout)
- Card faces that are always “dark plastic” (e.g. wallet list card art) may stay dark by design

---

## Overlays (Dialog / Sheet)

**Every** multi-field create or edit uses the shared **`ResponsiveOverlay`** (`src/components/overlay/responsive-overlay.tsx`): centered dialog from 768px up, bottom sheet below. Hand-rolled `isMobile ? <Sheet> : <Dialog>` forks are folded into it; Dialog-only multi-field forms gain the mobile sheet by moving onto it. Read-only drill-ins (e.g. the liquidez account detail) follow the same breakpoint split with a single **Cerrar**.

Overlays present differently by breakpoint:

| Breakpoint | Surface |
| --- | --- |
| Desktop (`md+`, ≥ 768px) | Centered modal **`Dialog`** |
| Mobile (`< 768px`) | Bottom **sheet** |

Mobile sheets follow Apple’s [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) model (modal sheet rising from the bottom, scrollable content, dismissible).

**Reference implementation:** **Agregar gasto** — `src/components/quick-capture/QuickExpenseSheet.tsx` (Panel financiero). `AddTransactionDialog.tsx`, `WalletForm.tsx` (Nueva meta / billetera), and `WalletTransferDialog.tsx` follow it exactly. When in doubt, open Agregar gasto and copy it.

Open these components in the running app. Do not commit overlay screenshots: the old files named wallets and issuers.

| Overlay | Component |
| --- | --- |
| Agregar gasto | `src/components/quick-capture/QuickExpenseSheet.tsx` |
| Nueva meta / billetera | `src/components/WalletForm.tsx` |
| Transferir saldo | `src/components/wallets/WalletTransferDialog.tsx` |

- The breakpoint lives **inside** `ResponsiveOverlay` (`useIsMobile()` from `src/hooks/use-mobile.ts`). Callers never branch on `isMobile` for layout or field sizes.
- Same fields, order, and actions on both breakpoints.
- Keep component filenames as `*Dialog` / `*Sheet`; the dual presentation is always on.
- Portaled Select/popover menus call `handleSelectOpenChange` (render-prop arg or `useOverlaySelectOpenChange()`), so closing a menu does not dismiss the sheet.

### Overlay chrome (Dialog and Sheet)

Same language on both surfaces:

1. **Cancelar** — `Button variant="ghost"` + `text-primary-text`, absolute **left** in the header; `showCloseButton={false}` (no top-right **X**)
2. **Title** — centered (`text-base font-semibold`); **no** icon beside the title
3. **Description** — not visible; keep `DialogDescription` / `SheetDescription` as **`sr-only`** for accessibility
4. **Primary** — one full-width submit (`OVERLAY_PRIMARY_BUTTON_CLASS`); no second Cancelar or Guardar
5. **Body** — grouped bordered rows (below), single column on both breakpoints

All of this is owned by `ResponsiveOverlay`. Do not re-implement the header.

### Body anatomy (top to bottom)

Wrap the body in `flex flex-col gap-3` (a `<form>` when it submits). Only these blocks, in this order; skip the ones you do not need:

1. **Context line** — optional one-liner that explains where the record lands (e.g. `Va a: 2ª quincena · septiembre 2026`). `OverlayHint role="status"`.
2. **Error** — `OverlayErrorBanner`. One style; never a hand-rolled `bg-destructive/*` box.
3. **Grouped card** — `OVERLAY_GROUPED_CARD_CLASS`. Each field is a row:
   - label + control → `FormGroupedRow` (react-hook-form) or `GroupedRow` (`htmlFor` when the control has an `id`)
   - amount → `FormAmountRow` / `AmountRow` (MXN chip + big mono amount; label sits **above** the amount)
   - date → `DateStepper` (required) or `OptionalDateStepper` (nullable, e.g. Fecha límite)
4. **Extra sections** — `OverlaySectionLabel` + a second grouped card (e.g. "Datos de crédito", "Comisión").
5. **Hint** — `OverlayHint` **below** the card it explains. Never inside the card.
6. **Warnings** — amber notice (`InsufficientWalletExpenseNotice` style) when a value needs attention before saving.
7. **Toggle rows** — `ToggleField layout="row" className="px-3"` (optional `helper`), outside the card.
8. **Primary** — one `Button` with `OVERLAY_PRIMARY_BUTTON_CLASS`. Loading copy uses `…` (`Guardando…`).
9. **Secondary actions** — optional `Button variant="ghost"` with `OVERLAY_SECONDARY_BUTTON_CLASS`, below the primary (e.g. "Quitar plan"). Destructive ones add `text-destructive`.

### Sizes (fixed; do not override per screen)

| Element | Value | Source |
| --- | --- | --- |
| Dialog | `max-w-md`, `p-5`, `gap-4` | `ResponsiveOverlay` |
| Sheet | `side="bottom"`, `max-h-[92vh]`, `rounded-t-xl`, body `p-4` + safe-area bottom | `ResponsiveOverlay` |
| Header | `min-h-10`; Cancelar `h-9 px-2 text-primary-text`; title `text-base font-semibold` | `ResponsiveOverlay` |
| Grouped card | `rounded-xl border border-border/60 bg-card divide-y divide-border/60` | `OVERLAY_GROUPED_CARD_CLASS` |
| Row | `px-3 py-1.5`, `min-h-11`, `gap-3` | `GroupedRow` / `FormGroupedRow` |
| Row label | `w-[5rem] text-sm font-medium` | `OVERLAY_GROUPED_LABEL_CLASS` |
| Select trigger in a row | `h-11`, borderless, transparent | `OVERLAY_ROW_TRIGGER_CLASS` |
| Text input in a row | `h-11`, borderless, transparent | `OVERLAY_ROW_INPUT_CLASS` |
| Number input in a row | same + `font-mono tabular-nums` | `OVERLAY_ROW_NUMBER_INPUT_CLASS` |
| Textarea in a row | `min-h-11`, borderless, `resize-none` | `OVERLAY_ROW_TEXTAREA_CLASS` |
| Amount | MXN chip + `text-2xl` (`md:text-4xl`) bold mono | `AmountRow` / `FormAmountRow` |
| Hint / context line | `px-1 text-xs text-muted-foreground` | `OverlayHint` |
| Section label | `px-1 text-xs font-medium text-muted-foreground` | `OverlaySectionLabel` |
| Primary | `h-11 w-full rounded-xl` | `OVERLAY_PRIMARY_BUTTON_CLASS` |
| Secondary | ghost, `h-9 w-full rounded-xl` | `OVERLAY_SECONDARY_BUTTON_CLASS` |

Everything above is exported from `src/components/overlay/overlay-form.tsx` (and `responsive-overlay.tsx`). If a field type is missing, **add it to the kit** — do not style it inline in the caller.

### Banned inside overlays

- Native visible `<input type="date">` → `DateStepper` / `OptionalDateStepper`
- Stacked `FormLabel` over a bordered `Input` / `SelectTrigger` → grouped row
- `CurrencyInput` with the `$` prefix for the main amount → `AmountRow` / `FormAmountRow`
- Local copies of `GroupedRow`, the MXN chip, or `w-[5rem]` label spans → import from the kit
- `isMobile ? 'h-11' : 'h-10'` or any per-breakpoint field sizing; two-column field grids
- Hand-rolled error boxes; hints inside the grouped card
- Raw `Dialog`, `Sheet`, or `AlertDialog` for a form or a confirm → `ResponsiveOverlay` / `ConfirmDeleteDialog`
- A footer Cancelar, a top-right X, an icon beside the title, or a second primary

### Confirms

Every confirm (delete, archive, "registrar sin descontar", "transferir de todos modos") uses **`ConfirmDeleteDialog`** (`src/components/ConfirmDeleteDialog.tsx`), which sits on `ResponsiveOverlay`: header Cancelar, sr-only description repeated as body copy, one full-width confirm. `tone="destructive"` (default) for delete, `tone="default"` otherwise; set `confirmLabel` / `loadingLabel`.

**Overlay vs page:** long, multi-step, or deep-linkable flows belong on a **route**, not in a sheet. This section applies only when an overlay is the right choice.

**Exceptions**

- Login, admin: out of scope. The marketing landing is in scope for light and dark.
- Existing Dialog-only forms: migrate onto `ResponsiveOverlay` + the kit (one flow per change is fine)
- Do not extract a mega form wrapper that owns fields/validation; the kit stays presentational

Agent rule: `.cursor/rules/responsive-overlays.mdc`. Skill: `/responsive-overlay` (`.claude/skills/responsive-overlay/SKILL.md`).

---

## Fintech data UI

- Amounts: **`<Money>`** (`src/components/money.tsx`). Sans with `tabular-nums` — never `font-mono`. Format with `formatMoney` / `formatCurrency` (`es-MX`). Negatives use that formatter’s single hyphen (`-$12.50`); do not prefix another minus or a `+`.
- Type scale (both themes, `text-*` utilities). Do not use `text-[Npx]`.

  | Step | Utility | Size | Use |
  | --- | --- | --- | --- |
  | Display | `text-display` | 30px / 700 | Rare hero words |
  | Title | `text-title` | 18px / 600 | The page title (`PageTitle`, the only `h1`) |
  | Section | `text-section` | 14px / 600 | `SectionHeader` (`h2`, nested `h3`) |
  | Body | `text-body` | 14px / 1.5 | Reading copy |
  | Caption | `text-caption` | 11px / 1.35 | Minimum size. Labels, hints |
  | Eyebrow | `eyebrow` | 11px / 600 / uppercase | Eyebrows. One utility, not a copied class string |

- `SectionHeader` (`src/components/section-header.tsx`) is the only section heading. `LiquidityPanelHeader` renders it. Page sections are `h2`; nested sections are `h3`. Do not add a second `h1`.
- Truncated names keep the full string in `title` or `aria-label`. Short labels such as **Utilización** wrap; they are not clipped.
- Weight follows size: **hero** `font-bold`, **row** `font-semibold`, **caption** `font-medium` (`MONEY_SIZE_CLASS`). Color follows `MONEY_TONE_CLASS`: neutral `text-foreground`, positive `text-status-income`, negative `text-status-expense`.
- Chart axes use `formatAxisMoney` (`$`, `k` from 1,000, `M` from 1,000,000).
- Charts (`src/components/charts/chart-theme.ts`, `chart-tooltip.tsx`): fills and strokes come from `--chart-1`…`--chart-5` and the status tokens (`--status-income`, `--status-expense`, `--status-pending`, `--status-success`, `--status-info`). Axis ticks use `CHART_AXIS_TICK` (11px, `--muted-foreground`). Grid and cursor use `--border` / a foreground mix. Every tooltip is `ChartTooltip` (popover surface, `shadow-panel`, `text-caption`). Do not hardcode hex or a second palette inside a chart component. Slice order cycles `chartSliceColor`.
- Dates go through `src/lib/calendar-dates.ts` (`America/Mexico_City`). Do not call `toLocaleDateString`, `toLocaleString` for a month name, or keep a month-name array in a screen.
  - **Titles** (`formatMonthTitle`, `formatMonthHeading`, `formatMonthYearTitle`): capitalized. `Septiembre` in the current Mexico City year; `Septiembre 2025` or `Noviembre de 2025` otherwise.
  - **Phrases** (`formatMonthPhrase`, `formatMonthInPhrase`, `formatMonthYearPhrase`): lowercase. `septiembre`, or `septiembre de 2025`.
  - **Rows** (`formatDisplayDate` / `formatRowDate`): `31 may`, or `31 may 2025` when the year is not current.
  - **Ranges** (`formatWallClockDateRange`, `formatChartMonthRange`, fortnight labels): hide the year inside the current year. Show the year on both ends when the range crosses years.
  - **Chart axes** (`formatChartAxisMonth`): `sep`, or `sep 25`.
  - **Steppers** (`formatStepperDate`) always include the year. The control is an input, so the saved day stays unambiguous.
  - Statement parsers keep a month map because they read bank files. Préstamos uses these helpers.
- Currency inputs use the same sans + `tabular-nums` face so `0.00` has no gap around the decimal.
- Metric / KPI strips: `METRIC_STRIP_CLASS` + `border-l-[3px] border-l-*-500/50`. **No** tinted panel fills (`bg-*-500/5`). Enforced by `npm run validate:metric-strips`.
- Semantic status (both themes, `globals.css`): **success** (pagado), **pending**, **overdue** (vencido), **income**, **expense**, **info**. Each token has text (`text-status-*`), soft fill (`bg-status-*-soft`), and border (`border-status-*-border`). Use `STATUS_*_CLASS` in `src/lib/status-tone.ts`. Do not use raw Tailwind palette classes (emerald, rose, amber, violet, blue…) for these states.
  - An expense row uses **expense** for the icon, the amount, and the type badge. A due or paid chip may use **overdue**, **pending**, or **success** — that is the time status, not a second type color.
  - Income rows use **income** the same way.
  - Overdue shares the destructive hue; it is its own token so Préstamos and the rest of the app match.
- Icon pills: `STATUS_SOFT_CLASS`, not a full card wash.
- `Button` `default` is `bg-primary` in both themes (no hex override). `destructive` stays full `--destructive` with `--destructive-foreground` in dark — do not fade it to `/60`.
- Hex in `className` only when no token exists. `#3a37fc` is `--primary`, dark `#060914` is `--background`, the light-mode status-bar strip is `--chrome-ink`, `#0d1327` is `--card` / `--popover`, `#090e1d` is `--secondary` / `--sidebar`. Marketing and login keep their own surfaces.
- Tables: footer row `border-t-2 border-border/60 bg-muted/30`, totals in `<Money size="row">`.
- Horizontal chips (wallets): `overflow-x-auto`, `shrink-0`, edge fades `from-background`.

Pages own **content only**. Do not re-wrap `(app)/layout.tsx` (sidebar, `AppAtmosphere`, sticky header, `container`). Page rhythm: `space-y-5`. Title, search, filters, and the primary action live in the app header — no in-page sticky action bar (see **Chrome**).

---

## Filters

- `FilterChip` (`src/components/filter-chip.tsx`) is a single on/off filter: Billeteras, Metas, Operaciones, and the Configuración mobile nav. It sets `aria-pressed` (or `aria-current="page"` when it is a link), can show a count, and uses a 44px target on mobile (`min-h-11`, `sm:min-h-9`) with a visible focus ring.
- `SegmentedControl` (`src/components/segmented-control.tsx`) chooses one of two or three views. It is the motion tabs (`variant="pill"`) so reduced motion already zeros the indicator. Use it for quincena, Plan horizon and strategy, Presupuestos, and Análisis (Liquidez / Plan).

## Surfaces

Three surfaces. Radius does not change with the theme.

| Surface | Where | Radius | Shadow |
| --- | --- | --- | --- |
| Panel glass | `orion-panel-glass` / `MONTHLY_PANEL_SHELL_CLASS` | `rounded-2xl` | `--shadow-panel` (`shadow-panel`) |
| Calm card | `.card-surface`, settings cards | `rounded-xl` | `--shadow-card` (`shadow-card`) |
| Card face | Wallet and credit-card faces, desktop Billeteras only | `rounded-face` (1.375rem) | `--shadow-face` (`shadow-face`) |

**Billeteras layout.** Below `md`, Billeteras is a list of calm rows (`bg-card`, one row per wallet). Disponible, Límite, and saldo sit in the row, and rows do not overlap. From `md` up, the same wallets are card faces in a grid. That face uses the `wow` tone: dark plastic in light and dark, like a physical card, not a theme surface (`isProviderCardDarkSurface`). Do not paint a light-theme version of the face. The Panel wallet strip may still use the theme-adaptive `aura` tone. The Prestamistas chip stays off this page.

**Alertas.** The bell sits in the sidebar footer. Below `md` it opens a `ResponsiveOverlay` sheet titled Alertas and closes the sidebar. From `md` it opens a menu to the right of the footer so the panel wallet strip stays visible. Severity uses status tokens (`overdue`, `pending`, `info`). Empty, error, and loading use `EmptyState`, `ErrorBanner`, and skeletons.

**Onboarding** sits outside the `(app)` layout, so it draws `AppAtmosphere` itself and uses the planner glass shell, the type scale, and one progress bar. Create copy starts with **Agregar**.

Do not use `dark:rounded-*`, `rounded-[...]`, or `shadow-[...]`. A table inside a card passes `embedded` to `DataTable` so the card owns the border. Buttons use `rounded-xl` on the page and in overlays. KPI tiles are a calm card with a status left border, not a gradient fill. `--shadow-glow` is only the planner progress knob.

## Empty, error, and loading

- Empty lists, filters, and charts use `EmptyState` (`src/components/EmptyState.tsx`).
- Failures use one banner: `ErrorBanner` (`src/components/error-banner.tsx`). Overlays re-export it as `OverlayErrorBanner`. Route errors use `AppErrorScreen`.
- Each route `loading.tsx` matches its archetype (planner, collection cards, collection table, detail, settings, form) via `src/components/loading/page-skeletons.tsx`. The root splash stays the Orion brand loader.
- A button in progress shows a word with an ellipsis (`Guardando…`, `Creando…`). It does not show a spinner.
- Billeteras hides the “N de N” count until stored filters are applied and the list has finished loading.

## Glossary

Use these names in the UI, in `PageTitle`, and in the browser tab. The document title (`documentTitle`) matches the header for that route.

| Concept | Say | Do not say |
| --- | --- | --- |
| The section | **Operaciones** | Transacciones (as the page name) |
| One record | **movimiento** | transacción |
| Money container | **billetera** | cartera, or “cuenta” for a wallet |
| Signed-in profile | **Cuenta** (only under Configuración) | — |
| Credit-card statement | **Estado de cuenta** | — |
| Linked wallet on a loan | **Billetera relacionada** | Cuenta relacionada |
| Create | **Agregar** | Nueva / Nuevo on create actions |
| Badges | Sentence case (`Gasto`, `Ingreso`, `Pagada`) | all-lowercase or ALL CAPS badges |
| Ellipsis | **…** | `...` |
| Analysis section | **Análisis** | Liquidez y análisis, as a nav item |

**Análisis** is the section (nav, document title, header). Its two views are the tabs **Liquidez** and **Plan**. The tab list is named Análisis.

Default expense categories for a new home come from `DEFAULT_CATEGORY_CATALOG` in Spanish (`Comida`, not `Food`). Existing rows already stored as `Food` are not migrated in code.

## Do / don’t

**Do**

- Reuse CSS variables and the shared glass / CTA classes.
- Put **electric blue** on the primary action (app and landing); keep `--primary` for selection, icon-pill fills, and focus. Use `--primary-text` (`text-primary-text`) for dates, links, and amounts on navy — in dark that is `#f7f8ff`, same as body text.
- Match Panel financiero before inventing a new card language. Landing product shots are captures of that UI.
- Capture README screenshots from **this** app (see below).

**Don’t**

- Commit Orion/Oriton (or any vendor) mockup PNGs, or chat-attached reference frames.
- Paint whole panels with `bg-blue-500/5` / `bg-violet-500/5` for “identity.”
- Load a second marketing typeface. The landing uses Geist + Manrope, same as the app.
- Add a second orange button beside the primary CTA.
- Use `toISOString().split('T')[0]` for business dates (see `src/lib/calendar-dates.ts`).

---

## Applying this to remaining app pages

When restyling Billeteras, Gastos, Tarjetas, Préstamos, etc.:

1. Pick the archetype (planner, collection, detail, settings) and keep domain structure (tables vs cards) from `.claude/skills/dashboard-ui/SKILL.md`.
2. Planner-grade panels use `MONTHLY_PANEL_SHELL_CLASS`; settings stay calm cards; card faces stay solid.
3. Register the one primary action in the app header; overflow for rare actions.
4. Metric strips stay calm + left border.
5. Verify in **dark and light** at desktop and a narrow viewport.

---

## Refreshing README screenshots

Product captures for the README live in `public/landing/` (fictional house Hogar). One file per screen, viewport, and theme: `{id}-{desktop|mobile}-{dark|light}.webp`. Screens: `panel`, `billeteras`, `liquidez`, `plan`, `prestamos`, `metas`, `operaciones`, `toca-pagar`. The README links those files. Do not add a second copy under `docs/images/`, and do not commit captures that show a real name, email, wallet, issuer, or amount.

`docs/images/orion-tokens.svg` is the palette swatch drawn from the table above; update it if hex values change.
