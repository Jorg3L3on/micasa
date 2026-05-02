# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm test             # Run Vitest tests (src/**/*.test.ts)
npm run ci           # Full CI: validate dashboard UI + prisma generate + test + build

# Database
npx prisma generate  # Regenerate Prisma client (outputs to src/generated/prisma)
npx prisma migrate dev --name <name>  # Create and apply a new migration
npx prisma db seed   # Seed database
npx prisma studio    # Open Prisma Studio

# Utilities
npm run validate:dashboard-ui       # Check dashboard metric strip consistency
npm run backfill:pantry-products    # Populate pantry products from existing receipts
```

## Architecture

### Stack
- **Next.js 16.1** (App Router) + **React 19** + **TypeScript**
- **PostgreSQL** via **Prisma 7** — `@prisma/adapter-neon` in production, `@prisma/adapter-pg` in development (see `src/lib/prisma.ts`)
- **NextAuth v5** (beta) with JWT strategy, credentials provider
- **Tailwind CSS v4** + **Radix UI** components + **@tanstack/react-table** for data tables
- **Zod v4** for validation, **react-hook-form** for forms
- **Vitest 4** for testing

### Core Domain Concept: Fortnights
The central planning unit is the **fortnight** — each month is split into two periods:
- `FIRST`: days 1–15
- `SECOND`: days 16–end of month

Expenses, incomes, budgets, and financial summaries are all organized around fortnights. See `src/lib/fortnights.ts` for calculation utilities.

### Multi-Tenancy: User vs House Context
All financial resources (wallets, categories, expenses, budgets, fortnights) can be owned by either a **User** or a **House** (shared household). This ownership is tracked via `user_id`/`house_id` nullable fields on most models.

The active context is managed client-side in `src/context/finance-context.tsx` and persisted to `localStorage`. API routes receive `ownerType` (`user` | `house`) and `ownerId` query params to scope queries.

### Request Flow
1. **Server-side fetches** (layouts/pages): `src/lib/api-server.ts` → `fetchFromApi()`
2. **Client-side mutations** (components): `src/lib/api/*` (e.g. `client-fetch.ts`, `wallets.ts`) → `clientFetchFromApi()` and domain helpers
3. **Route Handlers** (`src/app/api/**`): validate with Zod schemas → query via Prisma → return JSON
4. **Validation schemas** live in `src/schemas/` (one per domain)

### Key Directories

```
src/
  app/
    (dashboard)/         # Protected UI pages; each page.tsx does server-side data fetch
      budgets/           # Budget management
      categories/        # Expense/income categories
      credit-cards/      # Credit card tracking
      dashboard/         # Main overview
      expense-templates/ # Recurring expense templates
      expenses/          # Expense entry & listing
      fortnight/         # Single fortnight detail view
      fortnights/        # Fortnight list
      house-users/       # Household member management
      income-templates/  # Recurring income templates
      monthly/           # Monthly summary view
      pantry/            # Pantry / grocery tracking
      transactions/      # Transaction log
      wallets/           # Wallet management
    api/                 # REST API route handlers
      account/ auth/ budgets/ categories/ credit-cards/
      dashboard/ expense-templates/ expenses/ fortnights/
      house-users/ houses/ income-templates/ incomes/
      onboarding/ pantry/ reports/ transactions/ transfers/ users/ wallets/
  components/            # React components; ui/ contains Radix UI primitives
  context/               # finance-context.tsx — active owner context (user vs house)
  lib/
    prisma.ts            # Prisma singleton — `export default prisma` (used everywhere, 51 imports)
    db.ts                # Duplicate singleton with `export const db` — currently unused, candidate for removal
    auth.ts              # NextAuth config
    api/                 # Client-side fetch helpers (`client-fetch.ts`, domain modules)
    api-server.ts        # Server-side fetch helpers
    fortnights.ts        # Fortnight date calculation utilities
    transfers.ts         # Transfer domain utilities
    finance/             # Domain service layer
      *.service.ts       # budget, credit-card, expense, fortnight, wallet, transfer, template services
      liquidity-projection*.ts   # Cash flow / liquidity projection logic
      credit-card-statement*.ts  # Statement parsing & ledger logic
      wallet-accounting.ts       # Wallet balance calculations
    house/
      house.service.ts   # House domain queries
    observability/
      finance-log.ts     # Structured JSON finance event logging
    server/
      get-owner-context.ts       # Auth + owner resolution for route handlers
      credit-card-statement/     # Server-side statement import services & parsers
        statement-import.service.ts
        parse-mercado-pago-statement.ts
        parse-ca-departamental-statement.ts
        parse-ca-efectivo-statement.ts
        rollback-statement-import.service.ts
        mercado-pago-statement-import.service.ts
      pantry/                    # Server-side pantry processing
        compute-pantry-insights.ts
        parse-receipt-upload.ts
        sync-pantry-products-from-lines.ts
  schemas/               # Zod schemas per domain (one file per resource)
  types/                 # TypeScript types/DTOs
  generated/prisma/      # Auto-generated Prisma client (do not edit)
prisma/
  schema.prisma          # 545 lines, 18 models (see below)
  migrations/
  seed.ts
```

### Prisma Models
`Budget`, `BudgetAllocation`, `Category`, `CreditCardPayment`, `CreditCardStatementImport`, `Expense`, `ExpenseTemplate`, `Fortnight`, `House`, `HouseMember`, `Income`, `IncomeTemplate`, `PantryProduct`, `PantryReceipt`, `PantryReceiptLine`, `Transfer`, `User`, `Wallet`

### Prisma Client
Generated to `src/generated/prisma` (not the default location). Always import from there or use the singleton from `src/lib/prisma.ts` (`import prisma from '@/lib/prisma'`). After schema changes, run `npx prisma generate`.

The `prisma.ts` singleton switches adapters by environment:
- **Production**: `PrismaNeon` (serverless-safe, uses Neon's HTTP protocol)
- **Development**: `PrismaPg` with a connection pool

### API Route Pattern
All route handlers follow this standard pattern:
1. Call `getOwnerContext(request)` from `src/lib/server/get-owner-context.ts` — resolves auth, validates house membership, returns `{ ownerFilter, ownerType, ownerId, role }`.
2. Use `ownerFilter` (either `{ user_id, house_id: null }` or `{ user_id: null, house_id }`) directly in Prisma `where` clauses to scope queries.
3. Validate request body with the domain Zod schema from `src/schemas/`.

### Wallet Types & Expense Accounting
Wallets have a `PaymentMethodType` enum that determines cash-flow behavior:
- **Funding wallets** (`CASH`, `DEBIT_CARD`): direct cash outflow when an expense is paid
- **Credit wallets** (`CREDIT_CARD`, `DEPARTMENT_STORE_CARD`): tracked via statement cycles; paying an expense increases credit used, not cash spent

Cash outflow from credit cards enters the fortnights as either:
- Expenses paid with a funding wallet (e.g., "Pago tarjeta" registered in the fortnight)
- `CreditCardPayment` records with no linked expense

**Installment (cuota) expenses** are excluded from fortnight aggregates — they follow the credit card statement cycle instead. See `src/lib/finance/expense-planning-scope.ts`.

### Key Domain Enums
```
FortnightPeriod:    FIRST | SECOND
PaymentMethodType:  CASH | DEBIT_CARD | CREDIT_CARD | DEPARTMENT_STORE_CARD
HouseRole:          OWNER | ADMIN | MEMBER
TransferType:       USER_TO_HOUSE
BudgetFrequency:    DAILY | WEEKLY | BIWEEKLY | CUSTOM
```

### Liquidity Projection
`src/lib/finance/liquidity-projection*.ts` projects cash flow 180 days forward (configurable via `DEFAULT_PROJECTION_HORIZON_DAYS`). It accounts for recurring expenses, credit card statement cycles, and wallet balances. Surfaced in the dashboard via `LiquidityTeaserCard` and the `/api/wallets/liquidity-projection` endpoint.

### Credit Card Statement Import
Supports importing CSV/PDF statements from three issuers: **Mercado Pago**, **CA Departamental**, and **CA Efectivo**. Parsers live in `src/lib/server/credit-card-statement/`. Imports create `CreditCardStatementImport` records and can be rolled back.

### Auth
NextAuth is configured in `src/lib/auth.ts`. Session includes `userId`. Protected routes use middleware or layout-level session checks. The onboarding flow (`/onboarding`) runs once after registration.

### Environment Variables
```
DATABASE_URL    # PostgreSQL / Neon connection string (required)
NEXTAUTH_SECRET # JWT signing secret (required)
NEXTAUTH_URL    # App base URL, e.g. http://localhost:3000
```
