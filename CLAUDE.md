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
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **PostgreSQL** via **Prisma 7** with `@prisma/adapter-pg` (connection pooling)
- **NextAuth v5** (beta) with JWT strategy, credentials provider
- **Tailwind CSS v4** + **Radix UI** components
- **Zod** for validation, **react-hook-form** for forms
- **Vitest** for testing

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
2. **Client-side mutations** (components): `src/lib/api.ts` → `clientFetchFromApi()` and domain-specific helpers
3. **Route Handlers** (`src/app/api/**`): validate with Zod schemas → query via Prisma → return JSON
4. **Validation schemas** live in `src/schemas/` (one per domain)

### Key Directories
- `src/app/(dashboard)/` — Protected UI pages (each has a `page.tsx` doing server-side data fetch)
- `src/app/api/` — REST API route handlers
- `src/components/` — React components; `src/components/ui/` contains Radix UI primitives
- `src/lib/` — Prisma client (`db.ts`), auth config (`auth.ts`), API helpers (`api.ts`, `api-server.ts`)
- `src/schemas/` — Zod validation schemas per domain
- `src/types/` — TypeScript types/DTOs
- `prisma/` — Schema (542 lines, 20+ models), migrations, seed

### Prisma Client
The Prisma client is generated to `src/generated/prisma` (not the default location). Always import from there or use the singleton from `src/lib/db.ts`. After schema changes, run `npx prisma generate`.

### Auth
NextAuth is configured in `src/lib/auth.ts`. Session includes `userId`. Protected routes use middleware or layout-level session checks. The onboarding flow (`/onboarding`) runs once after registration.

### Environment Variables
```
DATABASE_URL    # PostgreSQL connection string (required)
NEXTAUTH_SECRET # JWT signing secret (required)
NEXTAUTH_URL    # App base URL, e.g. http://localhost:3000
```
