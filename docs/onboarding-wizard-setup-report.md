# Onboarding Wizard – Project Setup Report

Short technical report to design the fintech-style onboarding wizard. No code was modified.

---

## 1. Next.js App Router

**Confirmed.** The app uses the **App Router**:

- Routes live under `src/app/` with `layout.tsx`, `page.tsx`, and route groups like `(auth)` and `(dashboard)`.
- No `pages/` directory. `next` is `16.1.3` (package.json).

---

## 2. TypeScript

**Confirmed.** TypeScript is enabled:

- `tsconfig.json`: `"strict": true`, `"jsx": "react-jsx"`, `"paths": { "@/*": ["./src/*"] }`.
- `package.json`: `"typescript": "^5"` (devDependency), `@types/react`, `@types/node`, etc.
- Source files use `.ts` / `.tsx`.

---

## 3. shadcn/ui

**Installed.** The project uses the shadcn-style stack (Radix UI + CVA + Tailwind):

- **Radix UI:** `@radix-ui/react-alert-dialog`, `avatar`, `checkbox`, `collapsible`, `dialog`, `dropdown-menu`, `label`, `scroll-area`, `select`, `separator`, `slot`, `tooltip`.
- **Utilities:** `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.
- **Design tokens:** `globals.css` uses CSS variables (`--radius`, `--background`, `--primary`, etc.) consistent with shadcn theming.

**Components under `src/components/ui/`:**

| Component        | File                |
|-----------------|---------------------|
| alert           | `ui/alert.tsx`      |
| alert-dialog    | `ui/alert-dialog.tsx` |
| avatar          | `ui/avatar.tsx`      |
| badge           | `ui/badge.tsx`       |
| breadcrumb      | `ui/breadcrumb.tsx`  |
| button          | `ui/button.tsx`      |
| card            | `ui/card.tsx`       |
| checkbox        | `ui/checkbox.tsx`    |
| collapsible     | `ui/collapsible.tsx` |
| dialog          | `ui/dialog.tsx`     |
| dropdown-menu   | `ui/dropdown-menu.tsx` |
| form            | `ui/form.tsx` (react-hook-form + zod) |
| input           | `ui/input.tsx`      |
| label           | `ui/label.tsx`      |
| password-input  | `ui/password-input.tsx` |
| scroll-area     | `ui/scroll-area.tsx` |
| select          | `ui/select.tsx`     |
| separator       | `ui/separator.tsx`  |
| sheet           | `ui/sheet.tsx`      |
| sidebar         | `ui/sidebar.tsx`    |
| skeleton        | `ui/skeleton.tsx`   |
| table           | `ui/table.tsx`     |
| tabs            | `ui/tabs.tsx`      |
| tooltip         | `ui/tooltip.tsx`    |

No `progress`, `steps`, or `accordion` in `ui/` (useful for wizards); you can add them via shadcn if needed.

---

## 4. Tailwind CSS

**Confirmed.** Tailwind v4 is configured:

- `package.json`: `"tailwindcss": "^4"`, `"@tailwindcss/postcss": "^4"`, `"tw-animate-css": "^1.4.0"`.
- `postcss.config.mjs`: `plugins: { "@tailwindcss/postcss": {} }`.
- `src/app/globals.css`: `@import 'tailwindcss';` and `@import 'tw-animate-css';`, plus OKLCH design tokens.

---

## 5. NextAuth Authentication

**Confirmed.** NextAuth v5 (beta) is used:

- `package.json`: `"next-auth": "^5.0.0-beta.30"`.
- **Auth export and usage:** `auth()` is exported from `@/lib/auth` and used as a function (not a default export).

**Import pattern in the codebase:**

```ts
import { auth } from '@/lib/auth';
// ...
const session = await auth();
```

Used in: API routes (`api/onboarding/route.ts`, `api/account/route.ts`, etc.), server components (`(dashboard)/layout.tsx`, `(dashboard)/dashboard/page.tsx`, `onboarding/page.tsx`), and `src/proxy.ts`. The catch-all route uses `import { GET, POST } from '@/lib/auth'` from the same module.

---

## 6. Prisma Client Import Pattern

**Pattern:** API routes and server code import the shared Prisma instance from `@/lib/prisma`:

```ts
import prisma from '@/lib/prisma';
```

- `src/lib/prisma.ts` creates the client with the pg adapter (`PrismaPg`, `Pool`) and `export default prisma`.
- Prisma client is generated to `../src/generated/prisma` (see `schema.prisma`). Types/enums are imported from `@/generated/prisma/client` when needed (e.g. `HouseRole`, `TransferType`).

Use this same pattern in any new onboarding API routes.

---

## 7. Folder Structure

### `src/app/`

```
src/app/
├── layout.tsx                    # Root layout (SessionProvider, ThemeProvider, FinanceProvider)
├── page.tsx                      # Home
├── globals.css
├── api/
│   ├── account/route.ts
│   ├── auth/[...nextauth]/route.ts
│   ├── auth/register/route.ts
│   ├── categories/route.ts
│   ├── dashboard/route.ts
│   ├── expense-templates/route.ts
│   ├── expenses/[id]/paid/route.ts
│   ├── fortnights/route.ts, create-month/route.ts, created-months/route.ts, [id]/override-amount/route.ts
│   ├── income-templates/route.ts
│   ├── houses/route.ts
│   ├── onboarding/route.ts       # Existing onboarding API
│   ├── reports/route.ts
│   ├── transactions/route.ts
│   ├── transfers/route.ts
│   └── wallets/route.ts
├── (auth)/
│   ├── login/page.tsx, template.tsx
│   └── register/page.tsx, template.tsx
├── onboarding/
│   └── page.tsx                  # Existing onboarding page
└── (dashboard)/
    ├── layout.tsx                # Dashboard layout (sidebar, onboarding_completed guard)
    ├── loading.tsx, error.tsx
    ├── dashboard/page.tsx
    ├── account/page.tsx
    ├── categories/page.tsx, layout.tsx
    ├── expense-templates/..., expenses/..., income-templates/...
    ├── fortnight/[year]/[month]/[period]/page.tsx, ...
    ├── monthly/[year]/[month]/page.tsx
    ├── transactions/..., wallets/...
    └── ...
```

### `src/components/`

```
src/components/
├── ui/                           # shadcn-style primitives (see table above)
├── onboarding/
│   └── CreateWallet.tsx          # Current single-step onboarding UI
├── dashboard/                    # Dashboard-specific (tabs, cards, etc.)
├── app-sidebar.tsx, nav-main.tsx, nav-user.tsx, team-switcher.tsx
├── theme-provider.tsx, session-provider.tsx
├── login-form.tsx, register-form.tsx
├── CreateMonthCard.tsx, CreateMonthForm.tsx, WalletForm.tsx, CategoryForm.tsx, ...
├── ExpenseForm.tsx, AddExpenseDialog.tsx, ExpenseTable.tsx, ...
├── SummaryBlock.tsx, FortnightColumn.tsx, ...
└── ...
```

---

## 8. Onboarding Route

**Yes.** An onboarding route already exists:

- **Page:** `src/app/onboarding/page.tsx`  
  - Server component: requires session, checks `onboarding_completed`; if true redirects to `/dashboard`, else renders `CreateWallet`.
- **API:** `src/app/api/onboarding/route.ts`  
  - POST: creates default “Cash” wallet for the session user (or marks complete if one exists), sets `onboarding_completed`.
- **Component:** `src/components/onboarding/CreateWallet.tsx`  
  - Single step: “Crear mi primera billetera” → POST `/api/onboarding` → redirect to dashboard.

For a multi-step wizard you can either replace this single page with a wizard (e.g. `onboarding/` with steps or sub-routes) or add steps under the same route and keep the existing API as the final step.

---

## 9. framer-motion

**Not installed.** `package.json` has no `framer-motion` (or `motion`) dependency. You can add it for step transitions and micro-interactions:

```bash
npm install framer-motion
```

`tw-animate-css` is present for CSS-based animations if you prefer to avoid an extra JS library.

---

## 10. Middleware and onboarding_completed

**No middleware redirects based on `onboarding_completed`.**

- **Auth redirects:** `src/proxy.ts` exports a NextAuth-style middleware wrapper (`auth((req) => { ... })`). It:
  - Redirects unauthenticated users from `/dashboard` and `/` to `/login`.
  - Redirects authenticated users from `/login` and `/register` to `/dashboard`.
- **Important:** The project has **no `middleware.ts`** at root or under `src/`. Next.js only auto-loads `middleware.ts`. So unless the build or config wires `proxy.ts` as middleware, these redirects may not run; protection may rely on layout/page redirects.

**Where `onboarding_completed` is enforced:**

- **`src/app/(dashboard)/layout.tsx`** (server component): After `auth()`, loads `user.onboarding_completed`; if `!user?.onboarding_completed` → `redirect('/onboarding')`. So every route under `(dashboard)` is gated by onboarding completion.
- **`src/app/(dashboard)/dashboard/page.tsx`**: Also checks for a personal wallet; if none → `redirect('/onboarding')`.

So the **onboarding guard is in the dashboard layout (and dashboard page)**, not in middleware. For a wizard, you can keep this: users who haven’t completed onboarding hit the layout and get sent to `/onboarding` (or your new wizard root).

---

## Summary Table

| Item                         | Status |
|-----------------------------|--------|
| Next.js App Router          | Yes    |
| TypeScript                  | Yes    |
| shadcn/ui (Radix + CVA + UI)| Yes, many components |
| Tailwind CSS                | Yes (v4) |
| NextAuth `auth()`           | Yes, `import { auth } from '@/lib/auth'` |
| Prisma                      | Yes, `import prisma from '@/lib/prisma'` |
| Onboarding route            | Yes (`/onboarding` + API) |
| framer-motion               | No     |
| Middleware for onboarding   | No; guard is in dashboard layout |

Use this report to decide wizard structure (e.g. `/onboarding` with steps or sub-routes), which UI components to add (e.g. progress, steps), and whether to add framer-motion for animations.
