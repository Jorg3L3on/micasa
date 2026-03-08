# Authentication and Finance Architecture Report

**Purpose:** Architecture inspection for designing signup and onboarding. No code implemented—inspection only.

---

## 1. Authentication System

### 1.1 Is NextAuth being used?

**Yes.** NextAuth v5 (beta) is used.

- Package: `next-auth@^5.0.0-beta.30`
- Used in: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, session provider and sign-in/out in components.

### 1.2 NextAuth configuration file location

- **Route handler (entry):** `src/app/api/auth/[...nextauth]/route.ts` — re-exports `GET` and `POST` from `@/lib/auth`.
- **Configuration:** `src/lib/auth.ts` — contains the full NextAuth config (providers, callbacks, session strategy).

### 1.3 Providers configured

- **Credentials only.** No Google, GitHub, or other OAuth.
- In `src/lib/auth.ts`: `CredentialsProvider` with `email` and `password`.
- Login: `authorize()` loads user by email, then checks password with `compare()` (bcrypt).

### 1.4 How are passwords stored?

- **Hashing:** `bcryptjs` (`compare` for login, `hash` for registration).
- **Registration:** `src/app/api/auth/register/route.ts` uses `hash(password, 10)` before creating the user.
- **Login:** `src/lib/auth.ts` uses `compare(credentials.password, user.password)`.
- No argon2; no plain-text passwords.

### 1.5 User model in Prisma (full)

```prisma
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
```

### 1.6 Does the auth system support signup / registration?

**Yes.**

- **Signup API route:** `src/app/api/auth/register/route.ts`
- **Logic:** In that file only (no separate `register.service.ts`). It:
  - Validates body with Zod (`name`, `email`, `password`).
  - Checks email uniqueness.
  - Hashes password with bcrypt.
  - In a **single `prisma.$transaction`**:
    - Creates `User`.
    - Creates a **House** named `"Casa de ${name}"` with `owner_id = user.id`.
    - Creates **HouseMember** with `role: HouseRole.OWNER`.
  - Returns `{ id, email, name, house: { id, name } }` (201).

So registration already creates one default house and makes the user its owner.

### 1.7 How is the user session retrieved in API routes?

- **Method:** `auth()` from `@/lib/auth` (NextAuth v5).
- **Not used:** `getServerSession`; no custom JWT or cookie parsing in app code.
- **Flow:** `const session = await auth();` then check `session?.user?.id`. `session.user.id` is the stringified user id (from JWT).

**Example API route using auth:**

```ts
// src/app/api/account/route.ts (excerpt)
import { auth } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = Number(session.user.id);
  // ... use userId for prisma.user.update
}
```

Same pattern in `src/app/api/houses/route.ts` (GET and POST).

---

## 2. Prisma Schema (full models)

**User** — see §1.5.

**Wallet:**

```prisma
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

  user  User?  @relation(fields: [user_id], references: [id])
  house House? @relation(fields: [house_id], references: [id])

  expenses          Expense[]
  expense_templates ExpenseTemplate[]

  @@index([user_id])
  @@index([house_id])
}
```

**Category:**

```prisma
model Category {
  id          Int     @id @default(autoincrement())
  name        String
  description String?

  created_at DateTime @default(now())

  expenses          Expense[]
  expense_templates ExpenseTemplate[]
}
```

**Expense:**

```prisma
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
```

**Income:**

```prisma
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

  fortnight       Fortnight       @relation(fields: [fortnight_id], references: [id])
  user            User?           @relation(fields: [user_id], references: [id])
  income_template IncomeTemplate? @relation(fields: [income_template_id], references: [id])
  house           House?          @relation(fields: [house_id], references: [id])

  transferAsHouse Transfer? @relation("TransferHouseIncome")

  @@index([user_id])
  @@index([house_id])
  @@index([fortnight_id])
}
```

**Transfer:**

```prisma
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

**House:**

```prisma
model House {
  id       Int    @id @default(autoincrement())
  name     String
  owner_id Int?

  created_at DateTime @default(now())

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
```

**HouseMember:**

```prisma
model HouseMember {
  id       Int       @id @default(autoincrement())
  house_id Int
  user_id  Int
  role     HouseRole

  created_at DateTime @default(now())

  house House @relation(fields: [house_id], references: [id])
  user  User  @relation(fields: [user_id], references: [id])
}
```

**ExpenseTemplate:**

```prisma
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

  expenses Expense[]
  category Category? @relation(fields: [category_id], references: [id])
  house    House?    @relation(fields: [house_id], references: [id])
  user     User?     @relation(fields: [user_id], references: [id])
  wallet   Wallet?   @relation(fields: [wallet_id], references: [id])

  @@index([user_id])
  @@index([house_id])
}
```

**IncomeTemplate:**

```prisma
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

  incomes Income[]
  user    User?    @relation(fields: [user_id], references: [id])
  house   House?   @relation(fields: [house_id], references: [id])

  @@index([user_id])
  @@index([house_id])
}
```

**Fortnight:**

```prisma
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

  house House? @relation(fields: [house_id], references: [id])
  user  User?  @relation(fields: [user_id], references: [id])

  expenses Expense[]
  incomes  Income[]

  @@index([user_id])
  @@index([house_id])
  @@unique([user_id, month, year, period])
  @@unique([house_id, month, year, period])
}
```

**Enums (referenced above):** `PaymentMethodType`, `FortnightPeriod`, `HouseRole`, `TransferType` — as in schema.

---

## 3. Finance Service Architecture

### 3.1 Services in `/src/lib/finance`

- `expense.service.ts`
- `fortnight.service.ts`
- `template.service.ts`
- `transfer.service.ts`
- `wallet.service.ts`

### 3.2 Which services modify wallet balances (`wallet.amount`)?

- **`expense.service.ts`** — mutates `wallet.amount` when expenses are created/updated/toggled/deleted and `is_paid` and `wallet_id` are set:
  - Create: if `is_paid` and `wallet_id`, `amount: { decrement: expense.amount }`.
  - Update: computes deltas for old/new paid state and wallet; applies `increment`/`decrement`.
  - Toggle paid: `decrement` when marking paid, `increment` when unpaying.
  - Delete: if was paid and had wallet, `increment` by expense amount.
- **`transfer.service.ts`** — in `createUserToHouseTransferInTx`: user wallet `decrement`, house wallet `increment` when `userWalletId` / `houseWalletId` are provided.
- **`wallet.service.ts`** — does **not** change balance: `updateWalletMetadata` explicitly strips `amount` from the update payload (`const { amount: _ignoredAmount, ...updateFields } = data;`). Create only sets initial `amount` from input.

### 3.3 Are wallet mutations inside `prisma.$transaction`?

**Yes** for all balance-changing operations:

- **expense.service.ts:** All wallet updates are inside the same `prisma.$transaction` as the expense create/update/delete (e.g. lines 137–166, 191–331, 343–396, 406–428).
- **transfer.service.ts:** Wallet updates are inside `createUserToHouseTransferInTx(tx, ...)`, which is only ever called as `prisma.$transaction((tx) => createUserToHouseTransferInTx(tx, input))`.

**Code examples:**

**expense.service.ts — create (excerpt):**

```ts
const created = await prisma.$transaction(async (tx) => {
  const expense = await tx.expense.create({ ... });
  if (expense.is_paid && expense.wallet_id != null) {
    await tx.wallet.update({
      where: { id: expense.wallet_id },
      data: { amount: { decrement: expense.amount } },
    });
  }
  return expense;
});
```

**transfer.service.ts — public API and in-tx wallet update:**

```ts
return prisma.$transaction((tx) => createUserToHouseTransferInTx(tx, input));
// inside createUserToHouseTransferInTx:
if (userWalletId) {
  await tx.wallet.update({
    where: { id: userWalletId },
    data: { amount: { decrement: amount } },
  });
}
if (houseWalletId) {
  await tx.wallet.update({
    where: { id: houseWalletId },
    data: { amount: { increment: amount } },
  });
}
```

---

## 4. Category Ownership

**Category** has **no** `user_id` or `house_id`.

It only has: `id`, `name`, `description`, `created_at`, and relations to `Expense` and `ExpenseTemplate`. Categories are **global** (shared across users/houses). See full model in §2.

---

## 5. Wallet Ownership

**Wallet** has **both** optional FKs:

- `user_id  Int?`
- `house_id Int?`

So a wallet can be:

- User-owned: `user_id` set, `house_id` null.
- House-owned: `house_id` set, `user_id` null.

The finance logic (e.g. expense.service, template.service) enforces that the wallet’s owner matches the fortnight’s owner (user or house). See full model in §2.

---

## 6. Existing Onboarding Logic

### 6.1 Onboarding / initialize / bootstrap

- **Search:** `onboarding`, `initialize`, `bootstrap`, `default categories`, `seed` in `/src`.
- **Result:** No onboarding or bootstrap flow in app code. The word “onboarding” does not appear. “Seed” only appears in `prisma/seed.ts` (dev seed script).

### 6.2 Default categories

- **Not created at runtime** in the app. They exist only in **`prisma/seed.ts`**: categories like Telefonía, Internet, Tarjeta de crédito, Supermercado, etc. are created when you run the seed.
- **Categories API:** `src/app/api/categories/route.ts` — POST creates a category with only `name` and optional `description`; no user/house. No “default categories” creation on signup.

### 6.3 Wallets created automatically

- **No.** Wallets are created explicitly via `POST /api/wallets`, which calls `createWalletForDefaultUser` in `wallet.service.ts`. Registration does **not** create any wallets.
- **Registration** only creates: User, one House, one HouseMember (owner). No wallets, no categories, no fortnights.

**Relevant paths:**

- Seed (default data): `prisma/seed.ts`
- Category create (no defaults): `src/app/api/categories/route.ts`
- Wallet create: `src/app/api/wallets/route.ts` → `src/lib/finance/wallet.service.ts` (`createWalletForDefaultUser`)

---

## 7. Middleware or Route Guards

### 7.1 Route protection

- **Auth wrapper:** `src/proxy.ts` exports a default function: `auth((req) => { ... })` (NextAuth v5 middleware style). It:
  - Redirects to `/login` if path is `/dashboard` or `/` and user is not logged in.
  - Redirects to `/dashboard` if user is logged in and path is `/login` or `/register`.
- **Important:** The file is named **`proxy.ts`**, not `middleware.ts`. Next.js normally loads **`middleware.ts`** (at project root or under `src/`). There is **no `middleware.ts`** in the repo, so this auth logic may **not** run unless the project wires `proxy.ts` as middleware (e.g. root `middleware.ts` re-exporting it). As-is, route protection may rely on page-level checks.
- **Page-level guard:** `src/app/(dashboard)/account/page.tsx` uses `const session = await auth(); if (!session?.user) redirect('/login');`.

### 7.2 `onboarding_completed`

- **No.** There is no field or concept of `onboarding_completed` in the User model or anywhere in the codebase.

---

## 8. Current User Context Assumption (“default user”)

**Yes.** The system often assumes a single “first” active user when the session is not used.

Examples:

1. **`src/lib/finance/wallet.service.ts` — `createWalletForDefaultUser`**

   ```ts
   const defaultUser = await prisma.user.findFirst({
     where: { active: true },
     select: { id: true },
   });
   if (!defaultUser) {
     const error = new Error('No active user found to own wallet');
     (error as any).code = 'NO_DEFAULT_USER';
     throw error;
   }
   // ... creates wallet with user_id: defaultUser.id, house_id: null
   ```

2. **`src/app/api/fortnights/create-month/route.ts`**

   - Gets “default user” with `prisma.user.findFirst({ where: { active: true } })` to own new fortnights and to check existing fortnights for that user.

3. **`src/app/api/fortnights/[id]/override-amount/route.ts`**

   - Uses “first active user” for override amount logic: `prisma.user.findFirst({ where: { active: true } })`.

4. **`src/lib/finance/template.service.ts` — `expandIncomeTemplatesForFortnight`**

   - Uses `tx.user.findFirst({ where: { active: true } })` as fallback when an income template has no `user_id`.

So: **wallets, fortnights (create-month), override-amount, and template expansion** can all rely on “first active user” instead of the session user. This is a major constraint for multi-user and onboarding: these APIs do not necessarily act on the logged-in user.

---

## 9. Project Structure (simplified)

```
src/app/
  layout.tsx
  page.tsx
  (auth)/
    login/page.tsx, template.tsx
    register/page.tsx, template.tsx
  (dashboard)/
    layout.tsx, loading.tsx, error.tsx
    account/page.tsx
    dashboard/page.tsx
    expenses/
    transactions/
    monthly/[year]/[month]/
    wallets/
    income-templates/
    expense-templates/
    categories/
    fortnights/
    fortnight/[year]/[month]/[period]/
  api/
    account/route.ts
    auth/
      [...nextauth]/route.ts
      register/route.ts
    categories/route.ts
    dashboard/route.ts
    expense-templates/route.ts
    expenses/[id]/paid/route.ts
    fortnights/route.ts, create-month/route.ts, [id]/override-amount/route.ts, created-months/route.ts
    houses/route.ts
    income-templates/route.ts
    reports/route.ts
    transactions/route.ts
    transfers/route.ts
    wallets/route.ts

src/lib/
  api-server.ts
  api.ts
  auth.ts
  db.ts
  prisma.ts
  proxy.ts
  utils.ts
  fortnights.ts
  finance/
    expense.service.ts
    fortnight.service.ts
    template.service.ts
    transfer.service.ts
    wallet.service.ts
  house/
    house.service.ts

prisma/
  schema.prisma
  seed.ts
  migrations/
    (multiple migration folders)
  migration_lock.toml
```

---

## 10. Important Constraints (finance and auth)

- **Wallet balance:** Only changed via **expenses** (create/update/toggle paid/delete) and **transfers**, and only when the expense is paid and linked to a wallet (or transfer links wallets). `updateWalletMetadata` explicitly does **not** update `amount`.
- **Transactions:** All wallet balance updates run inside **`prisma.$transaction`** together with the related expense/transfer writes.
- **Fortnight ownership:** A fortnight must be either user-scoped (`user_id` set, `house_id` null) or house-scoped (`house_id` set, `user_id` null). Expense and template logic enforce this and that the wallet belongs to the same user or house as the fortnight.
- **Transfer-locked expenses:** Expenses created from a transfer cannot be updated (paid toggled) or deleted; they are treated as locked.
- **Deterministic fortnights:** `src/lib/fortnights.ts` defines `resolveOrCreateFortnight(ownerType, ownerId, year, month, period)`; fortnights are unique per `(user_id|house_id, month, year, period)` (see Prisma unique indexes).
- **Templates:** Expense/income template expansion uses a “default user” when template has no `user_id`; template generation is tied to fortnights and ownership checks.
- **Categories:** Global; no user/house. Safe to reuse for any user/house.
- **Registration:** Already creates one House and HouseMember (OWNER). No wallets, categories, or fortnights created on signup.
- **Session:** Session is retrieved with `auth()`; `session.user.id` is the string user id. Only some API routes (e.g. account, houses) use it; others (wallets, fortnights create-month, override-amount, template expansion) use “first active user” instead.

---

**End of report.** Use this to design signup and onboarding without duplicating or breaking the existing auth and finance invariants.
