# House/User Context System — Architecture Analysis

Analysis of the repository for implementing a House/User context system. **No code was modified.** Report only.

---

## SECTION 1 — PRISMA SCHEMA

### Full Prisma schema (`prisma/schema.prisma`)

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// Enums
enum PaymentMethodType {
  CASH
  DEBIT_CARD
  CREDIT_CARD
  DEPARTMENT_STORE_CARD
}

enum FortnightPeriod {
  FIRST // 1–15
  SECOND // 16–end of month
}

enum HouseRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

enum TransferType {
  USER_TO_HOUSE
}

model User {
  id       Int     @id @default(autoincrement())
  name     String
  email    String  @unique
  password String
  active   Boolean @default(true)

  created_at DateTime @default(now())

  // Personal finance
  fortnights       Fortnight[]
  incomes          Income[]
  expenses         Expense[]
  expenseTemplates ExpenseTemplate[]
  incomeTemplates  IncomeTemplate[]
  wallets          Wallet[]

  // Shared
  memberships HouseMember[]
  ownedHouses House[]
  transfers   Transfer[]
}

model Fortnight {
  id         Int             @id @default(autoincrement())
  start_date DateTime
  end_date   DateTime
  label      String
  month      Int
  year       Int
  period     FortnightPeriod
  closed     Boolean         @default(false)

  user_id  Int?
  house_id Int?

  created_at DateTime @default(now())

  // Relationships
  house House? @relation(fields: [house_id], references: [id])
  user  User?  @relation(fields: [user_id], references: [id])

  expenses Expense[]
  incomes  Income[]

  @@index([user_id])
  @@index([house_id])
  @@unique([user_id, month, year, period])
  @@unique([house_id, month, year, period])
}

model Category {
  id          Int     @id @default(autoincrement())
  name        String
  description String?

  created_at DateTime @default(now())

  // Relationships
  expenses          Expense[]
  expense_templates ExpenseTemplate[]
}

model ExpenseTemplate {
  id                       Int      @id @default(autoincrement())
  name                     String
  suggested_amount         Decimal? @db.Decimal(10, 2)
  is_recurring             Boolean  @default(false)
  applies_first_fortnight  Boolean  @default(false)
  applies_second_fortnight Boolean  @default(false)
  is_subscription          Boolean  @default(false)
  due_day                  Int?
  cutoff_day               Int?
  active                   Boolean  @default(true)

  category_id Int?
  house_id    Int?
  user_id     Int?
  wallet_id   Int?

  created_at DateTime @default(now())

  // Relationships
  expenses Expense[]
  category Category? @relation(fields: [category_id], references: [id])
  house    House?    @relation(fields: [house_id], references: [id])
  user     User?     @relation(fields: [user_id], references: [id])
  wallet   Wallet?   @relation(fields: [wallet_id], references: [id])

  @@index([user_id])
  @@index([house_id])
}

model Expense {
  id           Int       @id @default(autoincrement())
  description  String
  amount       Decimal   @db.Decimal(10, 2)
  is_paid      Boolean   @default(false)
  payment_date DateTime?
  due_day      Int?

  house_id            Int?
  fortnight_id        Int
  category_id         Int?
  expense_template_id Int?
  user_id             Int?
  wallet_id           Int?

  created_at DateTime @default(now())

  // Relationships
  fortnight        Fortnight        @relation(fields: [fortnight_id], references: [id])
  user             User?            @relation(fields: [user_id], references: [id])
  wallet           Wallet?          @relation(fields: [wallet_id], references: [id])
  category         Category?        @relation(fields: [category_id], references: [id])
  expense_template ExpenseTemplate? @relation(fields: [expense_template_id], references: [id])
  house            House?           @relation(fields: [house_id], references: [id])

  transferAsUser Transfer? @relation("TransferUserExpense")

  @@index([user_id])
  @@index([house_id])
  @@index([fortnight_id])
  @@index([wallet_id])
  @@index([expense_template_id])
}

model Income {
  id          Int      @id @default(autoincrement())
  amount      Decimal  @db.Decimal(10, 2)
  source      String?
  received_at DateTime

  user_id            Int?
  house_id           Int?
  fortnight_id       Int
  income_template_id Int?
  created_at         DateTime @default(now())

  // Relationships
  fortnight       Fortnight       @relation(fields: [fortnight_id], references: [id])
  user            User?           @relation(fields: [user_id], references: [id])
  income_template IncomeTemplate? @relation(fields: [income_template_id], references: [id])
  house           House?          @relation(fields: [house_id], references: [id])

  transferAsHouse Transfer? @relation("TransferHouseIncome")

  @@index([user_id])
  @@index([house_id])
  @@index([fortnight_id])
}

model IncomeTemplate {
  id                       Int      @id @default(autoincrement())
  name                     String
  suggested_amount         Decimal? @db.Decimal(10, 2)
  source                   String?
  applies_first_fortnight  Boolean  @default(false)
  applies_second_fortnight Boolean  @default(false)
  active                   Boolean  @default(true)

  user_id  Int?
  house_id Int?

  created_at DateTime @default(now())

  // Relationships
  incomes Income[]
  user    User?    @relation(fields: [user_id], references: [id])
  house   House?   @relation(fields: [house_id], references: [id])

  @@index([user_id])
  @@index([house_id])
}

model House {
  id       Int    @id @default(autoincrement())
  name     String
  owner_id Int?

  created_at DateTime @default(now())

  // Relationships
  owner            User?             @relation(fields: [owner_id], references: [id])
  members          HouseMember[]
  fortnights       Fortnight[]
  expenses         Expense[]
  expenseTemplates ExpenseTemplate[]
  wallets          Wallet[]
  transfersIn      Transfer[]
  incomes          Income[]
  incomeTemplates  IncomeTemplate[]
}

model HouseMember {
  id       Int       @id @default(autoincrement())
  house_id Int
  user_id  Int
  role     HouseRole

  created_at DateTime @default(now())

  // Relationships
  house House @relation(fields: [house_id], references: [id])
  user  User  @relation(fields: [user_id], references: [id])
}

model Wallet {
  id          Int               @id @default(autoincrement())
  name        String
  description String?
  amount      Decimal           @default(0) @db.Decimal(10, 2)
  type        PaymentMethodType
  cutoff_day  Int?
  due_day     Int?
  active      Boolean           @default(true)

  user_id  Int?
  house_id Int?

  created_at DateTime @default(now())

  // Relationships
  user  User?  @relation(fields: [user_id], references: [id])
  house House? @relation(fields: [house_id], references: [id])

  expenses          Expense[]
  expense_templates ExpenseTemplate[]

  @@index([user_id])
  @@index([house_id])
}

model Transfer {
  id       Int          @id @default(autoincrement())
  amount   Decimal      @db.Decimal(10, 2)
  type     TransferType
  user_id  Int
  house_id Int
  note     String?

  created_at DateTime @default(now())

  user_expense_id Int? @unique
  house_income_id Int? @unique

  user_expense Expense? @relation("TransferUserExpense", fields: [user_expense_id], references: [id])
  house_income  Income?  @relation("TransferHouseIncome", fields: [house_income_id], references: [id])

  user  User  @relation(fields: [user_id], references: [id])
  house House @relation(fields: [house_id], references: [id])

  @@index([user_id])
  @@index([house_id])
  @@index([created_at])
}
```

### Model summaries

| Model | Fields | Relations | Indexes | Unique constraints |
|-------|--------|-----------|---------|--------------------|
| **User** | id, name, email, password, active, created_at | fortnights, incomes, expenses, expenseTemplates, incomeTemplates, wallets, memberships, ownedHouses, transfers | — | email |
| **House** | id, name, owner_id, created_at | owner (User?), members (HouseMember[]), fortnights, expenses, expenseTemplates, wallets, transfersIn, incomes, incomeTemplates | — | — |
| **HouseMember** | id, house_id, user_id, role, created_at | house (House), user (User) | — | — |
| **Wallet** | id, name, description, amount, type, cutoff_day, due_day, active, user_id, house_id, created_at | user?, house?, expenses, expense_templates | [user_id], [house_id] | — |
| **Expense** | id, description, amount, is_paid, payment_date, due_day, house_id, fortnight_id, category_id, expense_template_id, user_id, wallet_id, created_at | fortnight, user?, wallet?, category?, expense_template?, house?, transferAsUser? | [user_id], [house_id], [fortnight_id], [wallet_id], [expense_template_id] | — |
| **Income** | id, amount, source, received_at, user_id, house_id, fortnight_id, income_template_id, created_at | fortnight, user?, income_template?, house?, transferAsHouse? | [user_id], [house_id], [fortnight_id] | — |
| **Transfer** | id, amount, type, user_id, house_id, note, created_at, user_expense_id, house_income_id | user_expense?, house_income?, user, house | [user_id], [house_id], [created_at] | user_expense_id, house_income_id |
| **Fortnight** | id, start_date, end_date, label, month, year, period, closed, user_id, house_id, created_at | house?, user?, expenses, incomes | [user_id], [house_id] | [user_id, month, year, period], [house_id, month, year, period] |
| **ExpenseTemplate** | id, name, suggested_amount, is_recurring, applies_first_fortnight, applies_second_fortnight, is_subscription, due_day, cutoff_day, active, category_id, house_id, user_id, wallet_id, created_at | expenses, category?, house?, user?, wallet? | [user_id], [house_id] | — |
| **IncomeTemplate** | id, name, suggested_amount, source, applies_first_fortnight, applies_second_fortnight, active, user_id, house_id, created_at | incomes, user?, house? | [user_id], [house_id] | — |
| **Category** | id, name, description, created_at | expenses, expense_templates | — | — |

---

## SECTION 2 — EXISTING HOUSE LOGIC

### Creating houses

- **`src/app/api/auth/register/route.ts`**  
  On registration, a house is created in the same transaction as the user: `House` with `name: "Casa de ${name}"`, `owner_id: u.id`, then `HouseMember` with `role: HouseRole.OWNER`. No dedicated “create house” API.
- **`prisma/seed.ts`**  
  Creates a `House` (“Casa John”) and `HouseMember` (OWNER) for the seed user. No application API for creating houses.

### Listing houses

- No API or UI found that lists houses for the current user.  
- **`src/lib/auth.ts`**  
  In `authorize`, the user is loaded with `ownedHouses: true` and those are passed into the JWT/session as `houses: user.ownedHouses`; the session type/callbacks do not expose this on the client in the current code (only id, name, email are set on token/session).

### House membership

- **`prisma/schema.prisma`**  
  `HouseMember` links `house_id`, `user_id`, `role` (HouseRole).  
- **`src/app/api/auth/register/route.ts`**  
  Creates the first membership (OWNER) when registering.  
- **`prisma/seed.ts`**  
  Creates one HouseMember.  
- No API to list members of a house, add/remove members, or change roles.

### House roles

- **`prisma/schema.prisma`**  
  `enum HouseRole { OWNER, ADMIN, MEMBER, VIEWER }`.  
- Used only in register and seed when creating the initial OWNER. No permission checks or role-based logic elsewhere.

### Switching house context

- No implementation. No stored “current house” (cookie, context, or URL).  
- **`src/components/team-switcher.tsx`**  
  UI shows a fixed list of “teams” (hardcoded `[{ name: 'MiCasa', logo: Home, plan: 'Gestión Financiera' }]`). Label says “Casas” but there is no house data or switching logic; selection is local state only and not persisted or used by APIs.

### Files referencing House or HouseMember

| File | Explanation |
|------|-------------|
| `prisma/schema.prisma` | Defines House, HouseMember, HouseRole and relations. |
| `src/lib/finance/transfer.service.ts` | Types and logic for user→house transfers (user_id, house_id). |
| `src/lib/finance/template.service.ts` | Uses house_id for income/expense templates and createUserToHouseTransferInTx. |
| `src/lib/finance/expense.service.ts` | Uses fortnight.user_id / fortnight.house_id and wallet house_id for ownership checks. |
| `src/app/api/transfers/route.ts` | GET/POST transfers; validates user, house, fortnights, wallets by user_id/house_id. |
| `src/app/api/fortnights/create-month/route.ts` | Imports createUserToHouseTransfer; creates fortnights for default user only (no house in this route). |
| `src/lib/transfers.ts` | Re-exports createUserToHouseTransfer. |
| `src/app/api/auth/register/route.ts` | Creates User, House, and HouseMember (OWNER) on register. |
| `src/lib/auth.ts` | Loads user with ownedHouses and passes to JWT (houses not currently on session). |
| `prisma/seed.ts` | Creates House and HouseMember for seed user. |

---

## SECTION 3 — AUTHENTICATION SYSTEM

### Provider

- **NextAuth** with **Credentials** provider and **JWT** session strategy.  
- Config: `src/lib/auth.ts`.  
- Route: `src/app/api/auth/[...nextauth]/route.ts` exports `GET` and `POST` from `@/lib/auth`.

### How the current user is obtained in API routes

- **Pattern:** `auth()` from `@/lib/auth` returns the session; `session?.user?.id` is the current user id (string).
- **Only one API uses it today:**  
  **`src/app/api/account/route.ts`** (PATCH):

```ts
import { auth } from '@/lib/auth';

// ...
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}
// ...
const userId = Number(session.user.id);
```

- No other API route under `src/app/api` calls `auth()` or `getServerSession`. So **transactions, fortnights, wallets, categories, expense-templates, income-templates, dashboard, reports, transfers** do **not** enforce the authenticated user; they operate on global data (e.g. first active user, or raw query params).

### Session contents (from `src/lib/auth.ts`)

- Callbacks set on the session: `session.user.id`, `session.user.name`, `session.user.email` (from token).  
- At login, the DB user is loaded with `ownedHouses: true` and `houses: user.ownedHouses` is stored on the token in the JWT callback, but the session callback does not add `houses` to `session.user`, so the client does not currently receive the list of houses.

---

## SECTION 4 — FINANCE SERVICE ARCHITECTURE

### Files in `/src/lib/finance`

| File | Purpose |
|------|--------|
| **expense.service.ts** | createExpense, updateExpense, toggleExpensePaid, deleteExpense. Validates category, fortnight (exactly one of user_id or house_id), wallet ownership (wallet must match fortnight’s user or house). Sets expense user_id/house_id from fortnight. Updates wallet amount on pay/unpay. |
| **transfer.service.ts** | createUserToHouseTransferInTx (in transaction), createUserToHouseTransfer. Creates Transfer, user-side Expense, house-side Income; optionally updates user and house wallets. Uses userId, houseId, userFortnightId, houseFortnightId. |
| **template.service.ts** | expandIncomeTemplatesForFortnight, expandExpenseTemplatesForFortnight. Applies templates to a fortnight (user or house); can create user→house transfers for house income templates. Uses createUserToHouseTransferInTx. |
| **fortnight.service.ts** | listFortnightsForCatalog. Lists all fortnights (no filtering by user/house) with id, name, start/end, active, year, month, period. |
| **wallet.service.ts** | listWallets (all), createWalletForDefaultUser (assigns first active user, house_id null), updateWalletMetadata, deleteWalletIfUnused. |

### Expense service and ownership

- **expense.service.ts**  
  - Reads fortnight’s `user_id` and `house_id`; requires exactly one to be set.  
  - Copies `user_id` and `house_id` from the fortnight onto the expense.  
  - Wallet must belong to the same owner as the fortnight (user or house).  
  So finance entities use **both** `user_id` and `house_id` as ownership: each expense/fortnight is either user-scoped or house-scoped.

### Transfer service

- **transfer.service.ts**  
  - Explicit **user_id** and **house_id** on Transfer.  
  - User expense: `user_id` set, `house_id` null.  
  - House income: `house_id` set, `user_id` null.  
  So ownership model is **user_id** for personal and **house_id** for house, with transfers linking user and house.

### Wallet logic

- **wallet.service.ts**  
  - listWallets: no filter.  
  - createWalletForDefaultUser: uses first active user, `house_id: null`.  
  - No house wallet creation in services.  
  Wallets have `user_id` and `house_id` in the schema; app currently only creates user wallets.

### resolveOrCreateFortnight

- **Location:** `src/lib/fortnights.ts`.  
- **Signature:** `resolveOrCreateFortnight(params: ResolveFortnightParams)` where params include:
  - `ownerType: 'user' | 'house'`
  - `ownerId: number`
  - `year`, `month`, `period`, optional `label`, optional `tx`
- **Behavior:** Finds or creates a fortnight with either `(user_id: ownerId, house_id: null)` or `(house_id: ownerId, user_id: null)`.  
- **Used by:** `src/app/api/fortnights/create-month/route.ts` — currently only for the **default user** (first active user); it does **not** create house fortnights or use house context.

### Finance entities ownership summary

- **user_id / house_id:**  
  Fortnight, Expense, Income, ExpenseTemplate, IncomeTemplate, Wallet all have optional `user_id` and `house_id`.  
  Invariant: a given entity is either user-owned (user_id set, house_id null) or house-owned (house_id set, user_id null).  
  Transfer always has both user_id and house_id (links user and house).  
- **No separate “FinanceOwner” or context type** in code; ownership is inferred from these two fields and from the fortnight attached to each transaction.

---

## SECTION 5 — EXISTING API ROUTES

All under `src/app/api`. Format: **METHOD PATH → FILE**.

| METHOD | PATH | FILE |
|--------|------|------|
| GET | /api/auth/[...nextauth] | src/app/api/auth/[...nextauth]/route.ts |
| POST | /api/auth/[...nextauth] | src/app/api/auth/[...nextauth]/route.ts |
| POST | /api/auth/register | src/app/api/auth/register/route.ts |
| PATCH | /api/account | src/app/api/account/route.ts |
| GET | /api/categories | src/app/api/categories/route.ts |
| POST | /api/categories | src/app/api/categories/route.ts |
| PUT | /api/categories | src/app/api/categories/route.ts |
| DELETE | /api/categories | src/app/api/categories/route.ts |
| GET | /api/dashboard | src/app/api/dashboard/route.ts |
| GET | /api/expense-templates | src/app/api/expense-templates/route.ts |
| POST | /api/expense-templates | src/app/api/expense-templates/route.ts |
| PUT | /api/expense-templates | src/app/api/expense-templates/route.ts |
| DELETE | /api/expense-templates | src/app/api/expense-templates/route.ts |
| PATCH | /api/expenses/[id]/paid | src/app/api/expenses/[id]/paid/route.ts |
| GET | /api/fortnights | src/app/api/fortnights/route.ts |
| GET | /api/fortnights/created-months | src/app/api/fortnights/created-months/route.ts |
| POST | /api/fortnights/create-month | src/app/api/fortnights/create-month/route.ts |
| PUT | /api/fortnights/[id]/override-amount | src/app/api/fortnights/[id]/override-amount/route.ts |
| GET | /api/income-templates | src/app/api/income-templates/route.ts |
| POST | /api/income-templates | src/app/api/income-templates/route.ts |
| PUT | /api/income-templates | src/app/api/income-templates/route.ts |
| DELETE | /api/income-templates | src/app/api/income-templates/route.ts |
| GET | /api/reports | src/app/api/reports/route.ts |
| GET | /api/transactions | src/app/api/transactions/route.ts |
| POST | /api/transactions | src/app/api/transactions/route.ts |
| PUT | /api/transactions | src/app/api/transactions/route.ts |
| DELETE | /api/transactions | src/app/api/transactions/route.ts |
| GET | /api/transfers | src/app/api/transfers/route.ts |
| POST | /api/transfers | src/app/api/transfers/route.ts |
| GET | /api/wallets | src/app/api/wallets/route.ts |
| POST | /api/wallets | src/app/api/wallets/route.ts |
| PUT | /api/wallets | src/app/api/wallets/route.ts |
| DELETE | /api/wallets | src/app/api/wallets/route.ts |

---

## SECTION 6 — DASHBOARD UI (TOP-LEFT SELECTOR)

- **File path:** `src/components/team-switcher.tsx`.  
- **Component name:** `TeamSwitcher`.  
- **Server vs client:** Client component (`'use client'`).  
- **Where it’s used:** `src/components/app-sidebar.tsx` in the sidebar header: `<TeamSwitcher teams={teams} />`.  
- **What it shows:** A single hardcoded “team”: `{ name: 'MiCasa', logo: Home, plan: 'Gestión Financiera' }`. The dropdown label is “Casas” but the list is static; no houses from the backend or session.  
- **How “current house/user” is determined:** It is not. The active item is `useState(teams[0])` (the only item). There is no persistence (cookie/URL/context), no API call for houses, and no link to the logged-in user’s houses. So there is **no real house or user context** in the UI.

---

## SECTION 7 — STATE MANAGEMENT

- **React Context:** Used only for UI: `FormFieldContext` / `FormItemContext` in `src/components/ui/form.tsx`, and `SidebarContext` in `src/components/ui/sidebar.tsx`. No app-level context for user/house/finance.  
- **Zustand / Redux:** Not used.  
- **URL state:** Used for filters and view options: `useSearchParams` in `TransactionFilters.tsx`, `CurrentPeriodSummaryCard.tsx`; dashboard and transactions pages receive `searchParams` (view, month, year, period, type). No house or user id in URL.  
- **Cookies:** NextAuth uses cookies for the session; no custom cookie for house or context.  
- **localStorage:** Not used in the codebase for app state.  
- **Conclusion:** No global state for “current house” or “current user context”. Session (NextAuth) holds the logged-in user; house/context selection is not implemented.

---

## SECTION 8 — DATA FETCHING

- **Client:** `clientFetchFromApi` in `src/lib/api.ts` — `fetch(endpoint, { credentials: 'include', headers: { 'Content-Type': 'application/json', ... } })` to same origin. Used by dashboard-related components, catalog pages, and sidebar.  
- **Server:** `fetchFromApi` in `src/lib/api-server.ts` — `fetch(endpoint, { cache: 'no-store' })` with base URL from `headers().get('host')`. Used by server components.  
- **No React Query or SWR.** No server actions for data fetching in the analyzed code.  
- **Example (dashboard):**  
  **`src/app/(dashboard)/dashboard/page.tsx`** (server component):
  - Reads `searchParams` (view, month, year, period).
  - Builds query string and calls `fetchFromApi<DashboardData>(\`/api/dashboard?${query.toString()}\`)`.
  - Passes result to `<DashboardTabs data={dashboardData} />`.

---

## SECTION 9 — PROJECT STRUCTURE

Simplified tree, 3 levels. App lives under `src/app`.

```
src/
  app/
    (auth)/
      login/
      register/
    (dashboard)/
      account/
      categories/
      dashboard/
      expense-templates/
      expenses/
      fortnight/
      fortnights/
      income-templates/
      monthly/
      transactions/
      wallets/
    api/
      account/
      auth/
      categories/
      dashboard/
      expense-templates/
      expenses/
      fortnights/
      income-templates/
      reports/
      transactions/
      transfers/
      wallets/
    layout.tsx
    page.tsx
    globals.css
  components/
    ui/
    dashboard/
  generated/
    prisma/
  hooks/
  lib/
    finance/
    (auth, api, api-server, db, fortnights, prisma, transfers)
  schemas/
  types/
  domain/
```

(Only `src` and `app` were requested; `app` at repo root was not present; all app routes are under `src/app`.)

---

## SECTION 10 — TYPES

### House / HouseMember

- **Prisma-generated:** Types for `House`, `HouseMember`, `HouseRole` come from `@/generated/prisma/client` (used in register route and seed).  
- **No custom app-level types** for House or HouseMember (e.g. no `HouseWithMembers` or DTOs in `src/types`).

### FinanceOwner / Context

- No type or interface named `FinanceOwner` or `Context` (for house/user context) in the codebase.  
- Sidebar uses `SidebarContext` (UI state) in `src/components/ui/sidebar.tsx`.

### Wallet

- **Prisma:** Wallet model and generated types.  
- **App:** `WalletListItem` in `src/types/catalog.ts` (id, name, amount, type, active, cutoff_day, due_day).  
- **Schemas:** `WalletFormValues`, `CreateWalletInput`, `UpdateWalletInput` from `@/schemas/wallet.schema` (used in wallet.service and API).

### Expense

- **Prisma:** Expense model and generated types.  
- **App:** `ExpenseListItem` in `src/types/catalog.ts` (id, name, category, categoryId, defaultAmount, paymentMethod, paymentMethodId, active).  
- **Services:** `CreateExpenseInput`, `UpdateExpenseInput`, `TogglePaidInput`, `DeleteExpenseInput`, `ExpenseWithMeta` in `src/lib/finance/expense.service.ts`.  
- **Schemas:** `CreateExpenseInput`, `UpdateExpenseInput`, `ExpenseFormValues`, `ExpenseAmountFormValues` in `src/schemas/expense.schema.ts` and transaction schema in `src/schemas/transaction.schema.ts`.

### Other catalog types

- **`src/types/catalog.ts`:** CategoryOption, PaymentMethodOption, ExpenseListItem, TransactionRow, FortnightListItem, ExpenseTemplateListItem, IncomeTemplateListItem, WalletListItem.  
- **`src/types/dashboard.ts`:** PeriodView, DashboardData (period, summary, availableVsCommitted, upcomingObligations, recentActivity, incomeBreakdown, expenseHealth, fixedVsVariable, periodComparison, alerts).

---

*End of report. No code was modified.*
