## Finance invariants and integrity rules

This document summarizes the core invariants enforced in the finance layer (DB + services).  
It is intentionally high-level so it stays in sync with the existing architecture.

### 1. Ownership: exactly one owner (user or house)

- **Applies to**: `Fortnight`, `Expense`, `Income`, `Wallet`, `ExpenseTemplate`, `IncomeTemplate`, `Loan`, and other owner-scoped resources.
- **Rule**: every record belongs to **either** a user **or** a house, never both and never neither.
- **Database**:
  - Enforced via `*_single_owner_check` `CHECK` constraints:
    - `(user_id IS NOT NULL AND house_id IS NULL) OR (user_id IS NULL AND house_id IS NOT NULL)`.
- **Service layer**:
  - When creating records, `user_id` / `house_id` are always derived from an owning `Fortnight` or the authenticated owner, never set independently.

### 2. Fortnights

- **Periods** (deterministic budgeting periods; not editable catalog records):
  - Days **1–15** → `FIRST`
  - Days **16–end of month** → `SECOND`
- **Uniqueness**:
  - At most one fortnight per owner and period:
    - `@@unique([user_id, month, year, period])`
    - `@@unique([house_id, month, year, period])`
- **Helper** (`src/lib/fortnights.ts`):
  - `getFortnightPeriodForDay(day)` decides `FIRST`/`SECOND`.
  - `resolveOrCreateFortnight({ ownerType, ownerId, year, month, period })`:
    - Finds existing fortnight for the owner or creates one with correct `start_date` / `end_date`.

#### Fortnight lifecycle (deterministic, read-only)

- **Creation**: Fortnights are **only** created via `resolveOrCreateFortnight(...)`. The application has no other code path that performs `prisma.fortnight.create`.
- **Entry point**: `POST /api/fortnights/create-month` is the sole API that creates fortnights. It calls `resolveOrCreateFortnight` for FIRST and SECOND of a given `(year, month)` for the default user, then expands expense and income templates.
- **Listing / lookup** (read-only):
  - `GET /api/fortnights` — returns all fortnights (for UI listing).
  - `GET /api/fortnights?year=...&month=...&period=...` — returns one fortnight by identity or `null`.
  - `GET /api/fortnights/created-months` — returns `{ year, month }` pairs that have both fortnights.
- **Overrides**: `PUT /api/fortnights/{id}/override-amount` stores a fortnight-specific amount override as a special `Income` row (`source = '__OVERRIDE__'`). It does **not** change the fortnight’s period or dates.
- **No catalog-style mutations**: There are no APIs or services to create, update, or delete fortnights arbitrarily. Labels and date ranges are set at creation by `resolveOrCreateFortnight` and are not editable. This ensures fortnights cannot be changed in ways that would break accounting or period consistency.

### 3. Wallets

- **Ownership**:
  - Wallets are owned by **exactly one** of:
    - a user (`user_id` set, `house_id` null), or
    - a house (`house_id` set, `user_id` null).
- **Balance mutations**:
  - Wallet `amount` is **only** changed via:
    - Expense creation / update / paid toggle.
    - Transfer creation (`createUserToHouseTransfer`).
  - The `wallets` API **ignores** `amount` on updates to prevent arbitrary edits.
- **Validation on use**:
  - For any `Expense` that references a wallet:
    - If the expense is user-owned, `wallet.user_id` must match and `wallet.house_id` must be `null`.
    - If the expense is house-owned, `wallet.house_id` must match and `wallet.user_id` must be `null`.

### 4. Expenses and incomes

- **Owner derivation**:
  - `Expense.user_id` / `Expense.house_id` (and similarly for `Income`) are derived from the owning `Fortnight`.
  - Moving an expense to a different fortnight also updates its owner fields accordingly.
- **Wallet effects**:
  - Expense _paid_ with a wallet → wallet `amount` **decrements** by the expense amount.
  - If an already–paid expense is edited (amount, wallet, or paid flag), the services:
    - First conceptually "undo" the old effect on the old wallet.
    - Then apply the new effect on the new wallet.
  - Unpaid expenses never touch balances.

### 5. Transfers (user → house)

- **Model**:
  - `Transfer` keeps:
    - `user_expense_id` → personal `Expense`.
    - `house_income_id` → house `Income`.
  - Both are created **atomically** inside a Prisma transaction.
- **Service** (`createUserToHouseTransfer`):
  - Always performs:
    1. Create `Transfer`.
    2. Create user `Expense` (paid) in the user fortnight.
    3. Create house `Income` in the house fortnight.
    4. Link both back to `Transfer`.
    5. Update wallets (optional user wallet decrement, optional house wallet increment).
- **Safety**:
  - Downstream APIs **do not** allow generic edits that would break transfer accounting:
    - Expenses generated from transfers cannot have their paid status or core fields changed via generic endpoints.

### 6. Templates

- **ExpenseTemplate**:
  - Flags:
    - `applies_first_fortnight`, `applies_second_fortnight`.
  - Generation logic:
    - For each fortnight and period, at most **one** expense per `(fortnight, template)` is created.
    - Generated expenses:
      - Use the template’s category and wallet (when ownership matches).
      - Are owned by the same user/house as the fortnight.
      - Start as **unpaid** (wallet balances are not touched at generation time).
- **IncomeTemplate**:
  - Personal income:
    - Directly creates `Income` entries in the user’s fortnights for the chosen periods.
  - House-related income (with `house_id`):
    - Uses a transfer:
      - Ensures a matching house fortnight exists.
      - Calls `createUserToHouseTransfer` to keep user expense + house income + wallets in sync.

### 7. Loans

- **Models**: `Loan` (schedule definition) and `LoanPayment` (installments). Payments belong to a loan; at most one `Expense` may reference a payment via `loan_payment_id`.
- **Wallet effects**: Marking a wallet-sourced payment paid goes through `loan.service.ts` / expense flows so funding wallet balances stay consistent with expenses.
- **Planning**: Scheduled loan payments feed liquidity projection and dashboard obligations; they are distinct from credit-card statement cycles and from unpaid expense templates.

### 8. Budget spend

- **Scope**: `BudgetPeriod` spend is computed from **paid** expenses (`is_paid: true`) matching each allocation’s `wallet_id` + `category_id` within the period window (`payment_date`).
- **Owner**: Spend queries always include the active `ownerFilter` (`user_id` or `house_id`), same as drill-down lists.
- **Installments**: Credit-card **cuota** expenses (both `credit_installment_current` and `credit_installment_total` set) are **excluded** from budget spend, consistent with fortnight planning aggregates.
- **Credit charges**: Unlike fortnight cash-flow totals, budget spend **does** count charges on credit/department-store wallets when those wallets are part of an allocation (budgets track category caps per wallet, not cash outflow).

### 9. Where to extend safely

- When adding new endpoints or services:
  - **Derive ownership** from:
    - `Fortnight`, or
    - Authenticated user / selected house context,
    - never by setting `user_id` / `house_id` independently.
  - **Reuse**:
    - `resolveOrCreateFortnight` for budgeting periods.
    - `createUserToHouseTransfer` for any user → house movement of money.
  - **Never**:
    - Update wallet balances outside the existing transaction-based logic.
    - Bypass `CHECK` constraints by leaving both owner fields null or both non-null.

