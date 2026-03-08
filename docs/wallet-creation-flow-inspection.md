# Wallet Creation Flow Inspection

**Purpose:** Verify wallet creation logic before implementing onboarding. The system currently uses a "default user" pattern; this report confirms where it appears and what is required to safely create the first wallet for the **authenticated user** when moving to multi-user.

**No code implemented—inspection only.**

---

## 1. Wallet Creation API

**File:** `src/app/api/wallets/route.ts`

### 1.1 What function handles `POST /api/wallets`?

The **`POST`** export (the `POST` request handler) handles `POST /api/wallets`. There is no named wrapper; the handler is the async function assigned to `POST`.

### 1.2 Does this API use the authenticated session user?

**No.** The POST handler does **not** call `auth()` or use the session. It:

1. Parses the request body with `createWalletSchema`.
2. Calls `createWalletForDefaultUser(validatedData)`.
3. Returns the created wallet or handles errors (e.g. `NO_DEFAULT_USER`).

So wallet creation is entirely driven by the **service**, which uses `prisma.user.findFirst({ where: { active: true } })`, not the session user.

### 1.3 Full POST handler

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createWalletSchema.parse(body);

    try {
      const wallet = await createWalletForDefaultUser(validatedData);
      return NextResponse.json(wallet, { status: 201 });
    } catch (error: any) {
      if (error.code === 'NO_DEFAULT_USER') {
        return NextResponse.json(
          { error: 'No active user found to own wallet' },
          { status: 400 },
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Wallet with this name already exists' },
        { status: 409 },
      );
    }

    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallets', status: 500 },
      { status: 500 },
    );
  }
}
```

---

## 2. Wallet Service

**File:** `src/lib/finance/wallet.service.ts`

### 2.1 Full `createWalletForDefaultUser` function

```ts
export async function createWalletForDefaultUser(data: CreateWalletInput) {
  const defaultUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });

  if (!defaultUser) {
    const error = new Error('No active user found to own wallet');
    (error as any).code = 'NO_DEFAULT_USER';
    throw error;
  }

  return prisma.wallet.create({
    data: {
      name: data.name,
      amount: data.amount,
      type: data.type,
      active: data.active,
      cutoff_day: data.cutoff_day,
      due_day: data.due_day,
      user_id: defaultUser.id,
      house_id: null,
    },
  });
}
```

### 2.2 Does it always assign the wallet to `prisma.user.findFirst({ active: true })`?

**Yes.** The wallet is always assigned to whichever user is returned by:

```ts
prisma.user.findFirst({
  where: { active: true },
  select: { id: true },
})
```

There is no ordering (e.g. `orderBy`), so the "first" user is database-order dependent. The wallet is created with `user_id: defaultUser.id` and `house_id: null`.

### 2.3 Is there any function that creates a wallet for a specific `user_id`?

**No.** The only wallet-creation function in the codebase is `createWalletForDefaultUser`. There is no:

- `createWalletForUser(userId: number, data: CreateWalletInput)`
- or any other function that accepts an explicit user (or house) id for wallet creation.

**Conclusion:** All wallet creation currently goes through `createWalletForDefaultUser` and therefore **relies on the default user** (`findFirst` with `active: true`). To support onboarding and multi-user, a path that creates a wallet for a **specific** user (e.g. session user) will need to be added or the existing one extended.

---

## 3. Wallet Ownership Validation

Ownership is **not** expressed as "wallet belongs to session user." It is expressed as "wallet belongs to the same context (user or house) as the fortnight (or transfer)."

### 3.1 In `expense.service.ts`

- When creating or updating an expense, if a `wallet_id` is provided, the service loads the wallet and the fortnight.
- It checks that the **wallet’s owner matches the fortnight’s owner:**
  - If fortnight is user-scoped (`fortnight.user_id != null`): wallet must have `user_id === fortnight.user_id` and `house_id === null`.
  - If fortnight is house-scoped (`fortnight.house_id != null`): wallet must have `house_id === fortnight.house_id` and `user_id === null`.
- There is **no** `session.user.id` here; ownership is **wallet ↔ fortnight**, not wallet ↔ session.

Relevant snippet (create):

```ts
if (fortnight.user_id != null) {
  if (walletOwnerUserId !== fortnight.user_id || walletOwnerHouseId !== null) {
    const error = new Error(
      'Wallet does not belong to the same user as the fortnight',
    );
    (error as any).code = 'INVALID_WALLET_OWNER';
    throw error;
  }
} else if (fortnight.house_id != null) {
  if (walletOwnerHouseId !== fortnight.house_id || walletOwnerUserId !== null) {
    const error = new Error(
      'Wallet does not belong to the same house as the fortnight',
    );
    (error as any).code = 'INVALID_WALLET_OWNER';
    throw error;
  }
}
```

Same idea in `updateExpense` and `toggleExpensePaid` (wallet must match fortnight’s user or house).

### 3.2 In `src/app/api/transfers/route.ts`

- The transfer API receives `user_id`, `house_id`, and optional `user_wallet_id` / `house_wallet_id` in the **request body** (not from session).
- It loads each wallet by id and checks:
  - User wallet: `wallet.user_id === data.user_id` and `wallet.house_id === null`.
  - House wallet: `wallet.house_id === data.house_id` and `wallet.user_id === null`.
- So ownership is "wallet matches the user/house in the request," **not** "wallet belongs to the logged-in user."

Snippet:

```ts
if (userWalletId != null) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: userWalletId },
    select: { id: true, user_id: true, house_id: true },
  });
  if (!wallet || wallet.user_id !== data.user_id || wallet.house_id !== null) {
    return NextResponse.json(
      { error: 'Invalid user wallet for this transfer' },
      { status: 400 },
    );
  }
}
// Similarly for house wallet: wallet.house_id === data.house_id && wallet.user_id === null
```

### 3.3 In `wallet.service.ts`

- **No** ownership check. `updateWalletMetadata` and `deleteWalletIfUnused` operate by wallet `id` only; they do not verify that the wallet belongs to the current user or house. So any caller that knows a wallet id can update or delete it (subject to "in use" check for delete).

**Summary:** Ownership validation exists only in **expense** (wallet ↔ fortnight) and **transfers** (wallet ↔ body user/house). The **wallets API and wallet.service** do not check session or any user_id when creating, updating, or deleting wallets.

---

## 4. Wallet Querying

### 4.1 `prisma.wallet.findMany`

There is a single place that uses `prisma.wallet.findMany`:

**`src/lib/finance/wallet.service.ts` — `listWallets`:**

```ts
export async function listWallets() {
  return prisma.wallet.findMany({
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
  });
}
```

- **No `where` clause.** It returns **all** wallets in the database.
- **No filter** by `user_id` or `house_id`.

### 4.2 Other wallet access

- **`expense.service.ts`:** `prisma.wallet.findUnique({ where: { id: effectiveWalletId } })` — lookup by id for ownership validation against fortnight; no list.
- **`src/app/api/transfers/route.ts`:** `prisma.wallet.findUnique` by id for user/house wallet validation; no list.

So the only "list" of wallets is **unfiltered** `listWallets()`. For multi-user, the UI and APIs that show "my wallets" will need to filter by `user_id` (and possibly `house_id`) or the list endpoint will need to be scoped to the session user (and optionally house).

---

## 5. Wallet Requirements for Expenses

**File:** `src/lib/finance/expense.service.ts`

### 5.1 Can an expense be created without `wallet_id`?

**Yes.** In `createExpense`:

- `walletId` is optional in the input type: `walletId?: number | null`.
- `effectiveWalletId` is set to `walletId ?? null`.
- The expense is created with `wallet_id: effectiveWalletId ?? undefined`, so `wallet_id` can be **null**.
- If `effectiveWalletId` is null, the block that loads the wallet and checks ownership is skipped; the expense is still created.

So expenses can be created **without** a wallet.

### 5.2 Is a wallet required when `is_paid = true`?

**No.** There is no validation that forces a wallet when `is_paid` is true. The logic is:

- If the client sends `is_paid: true` and a `wallet_id`, the expense is created and the wallet balance is decremented inside the same transaction.
- If `is_paid: true` but `wallet_id` is null, the expense is still created; the block that updates the wallet is guarded by `if (expense.is_paid && expense.wallet_id != null)`, so the balance update is simply **skipped**.

Relevant code:

```ts
const expense = await tx.expense.create({
  data: {
    fortnight_id: fortnightId,
    wallet_id: effectiveWalletId ?? undefined,
    // ...
    is_paid: isPaid,
    // ...
  },
  // ...
});

if (expense.is_paid && expense.wallet_id != null) {
  await tx.wallet.update({
    where: { id: expense.wallet_id },
    data: { amount: { decrement: expense.amount } },
  });
}
```

So: **wallet is optional** for expenses, including when `is_paid = true`. When provided and paid, the wallet is debited; when not provided, the expense is still valid and no wallet is updated.

---

## 6. Goal: Safe First Wallet for Authenticated User

### 6.1 Current state

- **POST /api/wallets** does **not** use the session. It calls `createWalletForDefaultUser`, which uses `prisma.user.findFirst({ where: { active: true } })`.
- There is **no** function to create a wallet for a given `user_id` (or house_id).
- **All** wallet creation therefore relies on the default user.
- Listing wallets returns **all** wallets; no filtering by user or house.

### 6.2 What onboarding needs

To safely create the **first wallet for the authenticated user** without relying on `findFirst` user:

1. **Wallet creation**  
   Either:
   - Add a function that creates a wallet for a **specific** `user_id` (and optionally `house_id`), and have the wallets API pass `session.user.id` (and optionally house context), or  
   - Extend the existing creation path to accept an optional user/house and use session when present.

2. **Wallets API**  
   - **POST:** Use `auth()`, get `session.user.id`, and call a creation path that assigns the wallet to that user (e.g. `user_id: Number(session.user.id)`, `house_id: null` for personal wallet). Do **not** use `createWalletForDefaultUser` for authenticated flows if the system is multi-user.

3. **Listing**  
   - **GET /api/wallets:** For multi-user, list should be scoped (e.g. by `user_id` and optionally `house_id` from session or context) so users only see their own (and their houses’) wallets. Today’s unfiltered `listWallets()` is not safe for multi-user.

4. **Update / delete**  
   - For consistency and security, update and delete should verify that the wallet belongs to the current user (or house the user can act for) before proceeding. Today they do not.

This inspection confirms that **onboarding can safely create the first wallet for the authenticated user** only after introducing a creation path that takes an explicit user (from session) and, if desired, using the same identity for listing and mutation checks—and **not** relying on `findFirst` user for that flow.

---

**End of report.**
