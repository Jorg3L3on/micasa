# MiCasa design system

Encode the UI in **tokens, recipes, and live screenshots of this codebase**. Do **not** commit third-party mockups or chat-attached reference images. Humans and agents should apply this file (plus the CSS tokens) when building or restyling screens.

**Canonical live surfaces** (match these, then roll the same language to other pages):

| Surface | Route | Code |
| --- | --- | --- |
| Marketing landing | `/` | `src/components/landing/*`, fonts in `src/app/page.tsx` |
| Login | `/login` | `src/components/login/*` |
| Panel financiero | `/monthly/{year}/{month}` | `src/components/monthly/*`, `src/app/(app)/monthly/` |

Runtime tokens live in `src/app/globals.css` (`.dark` for the app, `.landing-root` for marketing). Default theme is **dark** (`ThemeProvider` `defaultTheme="dark"`). Light-mode tokens still exist for the `d` hotkey; new work should look correct in dark first.

Agent entry points:

- This file (`DESIGN.md`) — visual contract
- `.cursor/rules/fintech-ui-design-system.mdc` — cards, metrics, money type
- `.cursor/rules/ui-consistency.mdc` — chrome, CTAs, hierarchy (always on)
- `.claude/skills/dashboard-ui/SKILL.md` (same copy in `.agents/skills/dashboard-ui/`) — page anatomy

---

## Visual contract

Navy canvas, glass cards, **orange pill CTAs**, **blue → magenta** accents. Atmosphere is soft blurred orbs, not busy illustration.

| Role | Hex | CSS / class |
| --- | --- | --- |
| Canvas | `#060914` | `--background`, `--landing-bg` |
| Surface / sidebar | `#090e1d` | `--secondary`, `--sidebar`, `--landing-surface` |
| Card | `#0d1327` | `--card`, `--landing-card` |
| Muted chip | `#12183a` | `--muted`, `--accent` |
| Text | `#f7f8ff` | `--foreground` |
| Muted text | `#9ca3af` | `--muted-foreground` |
| Electric blue (primary, brand) | `#3a37fc` | `--primary`, `--chart-1` |
| Violet glow / ring | `#911efe` | `--ring`, `--landing-glow-purple` |
| Magenta | `#cf1ae6` | `--landing-glow-magenta` |
| Pink | `#ee477a` | `--chart-2`, `--landing-glow-pink` |
| CTA orange | `#FF5733` → `#FF2E00` | `.landing-cta`, `Button` default in `.dark` |
| Featured / Pro border | `#FF4D00` → `#8A2BE2` | `.landing-pro-border` |
| Hairline | `rgb(255 255 255 / 0.08–0.1)` | `--border`, `dark:border-white/[0.08]` |
| Success / paid | emerald (`#34d399`, `emerald-400`) | `--chart-3` |
| Danger | destructive token | `--destructive` |

Brand mark (`MicasaMark`): gradient `#3a37fc` → `#ee477a`. Route progress (`NextTopLoader`): `#FF5733`.

Palette swatch (SVG, not a screenshot): [`docs/images/orion-tokens.svg`](docs/images/orion-tokens.svg).

---

## Two surfaces

### Marketing landing (`/`)

- **Fonts:** Manrope (`--font-landing-display`) + Nunito (`--font-landing-sans`) — scoped on the landing wrapper only. Do not load these on app routes.
- **Canvas:** `#060914` with `LandingAtmosphere` blue/pink orbs.
- **Primary CTA:** pill (`rounded-full`) + `.landing-cta` orange gradient + orange glow shadow. Secondary: ghost / hairline glass, not a second orange button.
- **Product mocks:** glass cards (`border-white/[0.08]`, `bg-[#0d1327]/80`, blur). Money in `font-mono tabular-nums`.
- **Featured pricing card:** `.landing-pro-border` (orange → purple).
- **Accent headline wash:** `.landing-accent-text`.

### Logged-in app (and login)

- **Fonts:** Geist + Geist Mono from the root layout. Money still `font-mono tabular-nums`.
- **Same navy tokens** as landing (`.dark` in `globals.css`).
- **`--primary` is electric blue** — icon pills, focus rings, toggle ON, active nav, semantic “selected”.
- **Primary labeled buttons in dark** use the **orange gradient** (`Button` `variant="default"`). Do not invent a second primary orange utility; use `<Button>`.
- **Atmosphere:** `AppAtmosphere` in `(app)/layout.tsx` (blue / pink / violet blurs). Login has its own aurora (`login-stage`).
- **Glass shells:** `MONTHLY_PANEL_SHELL_CLASS` in `src/components/monthly/monthly-panel-shell.ts`. Reuse it (or the same class string) for planner chrome, summaries, and similar panels — do not invent a new glass recipe per page.

```
relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm
dark:border-white/[0.08] dark:bg-[#0d1327]/80
dark:shadow-[0_24px_80px_-48px_rgba(58,55,252,0.45)] dark:backdrop-blur-xl
```

Sticky header: `bg-background/85 backdrop-blur-xl` and in dark `dark:bg-[#060914]/75` plus a soft blue drop shadow.

---

## Layout and controls

Keep chrome **sparse**. One dominant labeled control per block; rare actions in `DropdownMenu`.

1. **Chrome row** — month / owner / prev-next as icon + Spanish `Tooltip`. No strip of equal-weight buttons.
2. **Content row** — wide data (wallet chips, KPI strips) full width **below** chrome, not squeezed beside nav icons.
3. **Primary work** — the repeated action (add expense, pay, etc.) sits next to the data it changes.

Tertiary view controls: `Button variant="ghost"` at `h-8`–`h-9`. Stronger secondary: `outline` + `rounded-xl`. Marketing CTAs stay `rounded-full`; in-app default buttons stay the shared `Button` radius unless the control is a pill toggle (quincena, pricing).

Icon-only: always `aria-label` + usually `Tooltip` in Spanish.

Binary preferences: `Toggle` / `ToggleField` (`src/components/ui/toggle.tsx`). ON = `bg-primary` (electric blue). Checkbox only for multi-select.

### Viewport delete

List/card delete is viewport-split (`md` = 768px):

- **`md+`:** quiet trash icon (`hidden md:inline-flex`), no swipe.
- **Below `md`:** swipe-to-delete only (`swipeEnabled={isMobile}`); hide the trash icon.

Shared trailing control: `SwipeDeleteAction`. Confirm with `ConfirmDeleteDialog`. Reference: `src/components/categories/CategoryTreeRow.tsx`.

---

## Fintech data UI

- Amounts: **`font-mono tabular-nums`**. Format with `formatCurrency` from `@/lib/utils`.
- Metric / KPI strips: `METRIC_STRIP_CLASS` + `border-l-[3px] border-l-*-500/50`. **No** tinted panel fills (`bg-*-500/5`). Enforced by `npm run validate:metric-strips`.
- Semantic left-border / icon-pill colors:
  - Income / bank — blue
  - Paid / success — green / emerald
  - Pending / warning — amber
  - Balance / available — emerald
  - Expenses — violet
  - Overdue / negative — destructive
- Icon pills: small tinted square (`bg-*-500/10 dark:bg-*-500/15`), not a full card wash.
- Tables: footer row `border-t-2 border-border/60 bg-muted/30`, totals in mono.
- Horizontal chips (wallets): `overflow-x-auto`, `shrink-0`, edge fades `from-background`.

Pages own **content only**. Do not re-wrap `(app)/layout.tsx` (sidebar, `AppAtmosphere`, sticky header, `container`). Page rhythm: `space-y-5`. Sticky page bars: `top-16` (`group-has-data-[collapsible=icon]/sidebar-wrapper:top-12`).

---

## Do / don’t

**Do**

- Reuse CSS variables and the shared glass / CTA classes.
- Put orange on **the** primary action; keep `--primary` blue for selection, icons, and focus.
- Match landing mocks and Panel financiero before inventing a new card language.
- Capture README screenshots from **this** app (see below).

**Don’t**

- Commit Orion/Oriton (or any vendor) mockup PNGs, or chat-attached reference frames.
- Paint whole panels with `bg-blue-500/5` / `bg-violet-500/5` for “identity.”
- Mix Manrope/Nunito into the logged-in app.
- Add a second orange button beside the primary CTA.
- Use `toISOString().split('T')[0]` for business dates (see `src/lib/calendar-dates.ts`).

---

## Applying this to remaining app pages

When restyling Billeteras, Gastos, Tarjetas, Préstamos, etc.:

1. Keep domain structure (tables vs cards) from `.claude/skills/dashboard-ui/SKILL.md`.
2. Swap shells to glass (`MONTHLY_PANEL_SHELL_CLASS` or the same dark border/blur).
3. Use default `<Button>` for the section CTA; menus for overflow.
4. Metric strips stay calm + left border.
5. Verify in **dark** at desktop and a narrow viewport.

---

## Refreshing README screenshots

Replace files under `docs/images/` with captures of localhost (or production) — never with external mockups.

| File | What to capture |
| --- | --- |
| `docs/images/landing-hero.jpg` | `/` hero (headline + glass dashboard mock) |
| `docs/images/landing-pricing.jpg` | `/` pricing section |
| `docs/images/login.jpg` | `/login` |
| `docs/images/panel-financiero.jpg` | Panel financiero with a seeded month |

`docs/images/orion-tokens.svg` is drawn from the table above; update it if hex values change.
