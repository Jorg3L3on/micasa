# Finance System – Architectural Map

Structured overview of the current finance system for consistent future development.

---

## 1. Finance-related database models

### Fortnight

| Field        | Type            | Notes                          |
|-------------|------------------|--------------------------------|
| id          | Int (PK)         |                                |
| start_date  | DateTime         |                                |
| end_date    | DateTime         |                                |
| label       | String           |                                |
| month       | Int              | 1–12                           |
| year        | Int              |                                |
| period      | FortnightPeriod  | FIRST (1–15) or SECOND (16–EOM) |
| closed      | Boolean          | default false                  |
| user_id     | Int? (FK User)   | personal fortnight             |
| house_id    | Int? (FK House)  | house fortnight                |
| created_at  | DateTime         |                                |

- **Relations:** `house` (House?), `user` (User?), `expenses` (Expense[]), `incomes` (Income[]).
- **Constraints:** Exactly one of `user_id` or `house_id` must be set.  
  `@@unique([user_id, month, year, period])`, `@@unique([house_id, month, year, period])`.  
  Indexes on `user_id`, `house_id`.

---

### Expense

| Field                 | Type                    | Notes              |
|-----------------------|-------------------------|--------------------|
| id                    | Int (PK)                |                    |
| description           | String                  |                    |
| amount                | Decimal(10,2)           |                    |
| is_paid               | Boolean                 | default false      |
| payment_date          | DateTime?               |                    |
| due_day               | Int?                    |                    |
| house_id              | Int? (FK House)         |                    |
| fortnight_id          | Int (FK Fortnight)      | required           |
| category_id           | Int? (FK Category)      |                    |
| expense_template_id   | Int? (FK ExpenseTemplate)|                    |
| user_id               | Int? (FK User)          | from fortnight     |
| wallet_id             | Int? (FK Wallet)        |                    |
| created_at            | DateTime                |                    |

- **Relations:** `fortnight` (Fortnight), `user` (User?), `wallet` (Wallet?), `category` (Category?), `expense_template` (ExpenseTemplate?), `house` (House?), `transferAsUser` (Transfer? – when created by a transfer).
- **Constraints:** Owner (user/house) must match fortnight. If linked to a Transfer (`user_expense_id`), expense is locked (no update/paid toggle). Indexes on `user_id`, `house_id`, `fortnight_id`, `wallet_id`, `expense_template_id`.

---

### Income

| Field                 | Type                     | Notes        |
|-----------------------|--------------------------|--------------|
| id                    | Int (PK)                 |              |
| amount                | Decimal(10,2)             |              |
| source                | String?                  |              |
| received_at           | DateTime                 |              |
| user_id               | Int? (FK User)           |              |
| house_id              | Int? (FK House)          |              |
| fortnight_id          | Int (FK Fortnight)       | required     |
| income_template_id     | Int? (FK IncomeTemplate) |             |
| created_at            | DateTime                 |              |

- **Relations:** `fortnight` (Fortnight), `user` (User?), `income_template` (IncomeTemplate?), `house` (House?), `transferAsHouse` (Transfer? – when created by a transfer).
- **Constraints:** Indexes on `user_id`, `house_id`, `fortnight_id`.  
  Special use: `source = '__OVERRIDE__'` used for fortnight “override amount” (Tenemos).

---

### Wallet

| Field        | Type                | Notes                    |
|-------------|---------------------|--------------------------|
| id          | Int (PK)            |                          |
| name        | String              |                          |
| description | String?             |                          |
| amount      | Decimal(10,2)       | default 0 (balance)      |
| type        | PaymentMethodType   | CASH, DEBIT_CARD, etc.   |
| cutoff_day  | Int?                |                          |
| due_day     | Int?                |                          |
| active      | Boolean             | default true             |
| user_id     | Int? (FK User)      | personal wallet          |
| house_id    | Int? (FK House)     | house wallet             |
| created_at  | DateTime            |                          |

- **Relations:** `user` (User?), `house` (House?), `expenses` (Expense[]), `expense_templates` (ExpenseTemplate[]).
- **Constraints:** Exactly one of `user_id` or `house_id`. Indexes on `user_id`, `house_id`.  
  **Invariant:** `amount` is only changed via expense paid flows or transfer flows inside finance services (see §4).

---

### Transfer

| Field            | Type              | Notes                          |
|------------------|-------------------|--------------------------------|
| id               | Int (PK)          |                                |
| amount           | Decimal(10,2)     |                                |
| type             | TransferType      | currently USER_TO_HOUSE        |
| user_id          | Int (FK User)     | required                       |
| house_id         | Int (FK House)    | required                       |
| note             | String?           |                                |
| user_expense_id  | Int? (FK Expense, unique) | link to user-side expense  |
| house_income_id  | Int? (FK Income, unique)  | link to house-side income  |
| created_at       | DateTime          |                                |

- **Relations:** `user` (User), `house` (House), `user_expense` (Expense?), `house_income` (Income?).
- **Constraints:** After creation, transfer is updated with `user_expense_id` and `house_income_id` so the double-entry is traceable.

---

### ExpenseTemplate

| Field                    | Type                     | Notes                    |
|--------------------------|--------------------------|--------------------------|
| id                       | Int (PK)                 |                          |
| name                     | String                   |                          |
| suggested_amount         | Decimal?                 |                          |
| is_recurring             | Boolean                  | default false            |
| applies_first_fortnight  | Boolean                  | default false            |
| applies_second_fortnight | Boolean                  | default false            |
| is_subscription          | Boolean                  | default false            |
| due_day                  | Int?                     |                          |
| cutoff_day               | Int?                     |                          |
| active                   | Boolean                  | default true             |
| category_id              | Int? (FK Category)       | required for expansion   |
| house_id                 | Int? (FK House)          |                          |
| user_id                  | Int? (FK User)           |                          |
| wallet_id                | Int? (FK Wallet)         |                          |
| created_at               | DateTime                 |                          |

- **Relations:** `expenses` (Expense[]), `category` (Category?), `house` (House?), `user` (User?), `wallet` (Wallet?).
- **Constraints:** For template expansion, `category_id` must be set; wallet (if set) must belong to same owner as the fortnight.

---

### IncomeTemplate

| Field                    | Type            | Notes           |
|--------------------------|-----------------|-----------------|
| id                       | Int (PK)        |                 |
| name                     | String          |                 |
| suggested_amount         | Decimal?        |                 |
| source                   | String?         |                 |
| applies_first_fortnight  | Boolean         | default false   |
| applies_second_fortnight | Boolean         | default false   |
| active                   | Boolean         | default true    |
| user_id                  | Int? (FK User)  |                 |
| house_id                 | Int? (FK House) |                 |
| created_at               | DateTime        |                 |

- **Relations:** `incomes` (Income[]), `user` (User?), `house` (House?).
- **Constraints:** If `house_id` is set, expansion creates a User→House transfer instead of a simple Income.

---

### Category

| Field        | Type     | Notes |
|-------------|----------|--------|
| id          | Int (PK) |        |
| name        | String   |        |
| description | String?  |        |
| created_at  | DateTime |        |

- **Relations:** `expenses` (Expense[]), `expense_templates` (ExpenseTemplate[]).
- **Constraints:** Referenced by Expense and ExpenseTemplate; no finance invariants on Category itself.

---

### Other related models (non-finance core)

- **User:** has `fortnights`, `incomes`, `expenses`, `expenseTemplates`, `incomeTemplates`, `wallets`, `transfers`.
- **House:** has `fortnights`, `expenses`, `expenseTemplates`, `wallets`, `transfersIn`, `incomes`, `incomeTemplates`.
- **HouseMember:** links User to House with role; not directly used by finance services.

---

## 2. Finance service-layer functions

Location: `src/lib/finance/`.

### fortnight.service.ts

| Function                 | Purpose                                      | Reads            | Writes   | In transaction? |
|--------------------------|----------------------------------------------|------------------|----------|-----------------|
| listFortnightsForCatalog | List all fortnights for catalog/selector     | Fortnight        | —        | No              |

---

### expense.service.ts

| Function         | Purpose                                                                 | Reads                    | Writes        | In transaction? |
|------------------|-------------------------------------------------------------------------|--------------------------|---------------|-----------------|
| createExpense    | Create expense; if is_paid and wallet_id, decrement wallet              | Category, Fortnight, Wallet | Expense, Wallet | Yes (single tx) |
| updateExpense    | Update expense; reconcile paid/unpaid and wallet changes (deltas)       | Expense, Fortnight, Wallet, Transfer | Expense, Wallet | Yes (single tx) |
| toggleExpensePaid| Toggle is_paid; if wallet present, decrement on pay / increment on unpay| Expense, Transfer        | Expense, Wallet | Yes (single tx) |

- **Exported type:** `ExpenseWithMeta`, `CreateExpenseInput`, `UpdateExpenseInput`, `TogglePaidInput` (last three as types used by callers).
- Owner (user_id / house_id) is always taken from the fortnight, not from request.

---

### transfer.service.ts

| Function                     | Purpose                                                                 | Reads   | Writes                          | In transaction?     |
|-----------------------------|--------------------------------------------------------------------------|---------|----------------------------------|---------------------|
| createUserToHouseTransferInTx(tx, input) | In existing tx: create Transfer, user Expense, house Income, update wallets, link transfer to expense/income | —       | Transfer, Expense, Income, Wallet | Caller’s tx         |
| createUserToHouseTransfer(input)        | Wraps createUserToHouseTransferInTx in prisma.$transaction               | —       | Transfer, Expense, Income, Wallet | Yes (single tx)     |

- All wallet updates (user decrement, house increment) happen inside the same transaction.

---

### template.service.ts

| Function                         | Purpose                                                                 | Reads                    | Writes                    | In transaction? |
|----------------------------------|-------------------------------------------------------------------------|--------------------------|---------------------------|-----------------|
| expandIncomeTemplatesForFortnight(fortnightId, period)  | Create Income (or Transfer+Expense+Income) for matching income templates | Fortnight, IncomeTemplate, User, Transfer | Income, Fortnight, Transfer, Expense, Income, Wallet | Yes (single tx per call) |
| expandExpenseTemplatesForFortnight(fortnightId, period) | Create unpaid Expense from matching expense templates                    | Fortnight, ExpenseTemplate, Wallet | Expense                   | Yes (single tx per call) |

- Expense template expansion always creates expenses with **is_paid: false** (no wallet balance change).
- Income template expansion: personal → Income only; house → creates full User→House transfer (Expense + Income + optional wallet updates) via `createUserToHouseTransferInTx`.

---

### wallet.service.ts

| Function                  | Purpose                                                                 | Reads  | Writes | In transaction? |
|---------------------------|-------------------------------------------------------------------------|--------|--------|-----------------|
| listWallets               | List all wallets                                                        | Wallet | —      | No              |
| createWalletForDefaultUser| Create wallet for first active user (initial amount from input)         | User   | Wallet | No              |
| updateWalletMetadata      | Update wallet fields but **strips amount**; does not change balance     | —      | Wallet | No              |
| deleteWalletIfUnused      | Delete wallet if no expenses/templates reference it                     | Expense, ExpenseTemplate | Wallet | No              |

- **Invariant:** This module never mutates `wallet.amount` for accounting; only creation sets initial amount.

---

### liquidity-projection.service.ts & credit-card-statement.service.ts

- **credit-card-statement.service.ts:** `resolveCreditCardStatementWindow`, `getCreditCardStatementByOwner`, `getDuePaymentsForCurrentFortnight`, and `getStatementObligationBreakdownByWallet` (misma fórmula que `next_due_payment` en el estado).
- **liquidity-projection.service.ts:** `getLiquidityProjection` cruza saldos **CASH** / **DEBIT_CARD** con obligaciones por `until` (UTC): tarjetas vía `loadCreditCardActivityLedger` + `computeObligationBreakdownFromLedger` (2 queries por proyección), opcionalmente gastos impagos en funding, plantillas sin gasto en quincenas existentes, y escenario de estrés (% sobre ciclo cuando el estado cerrado va en $0). CSV: `liquidity-projection-csv.ts`.

---

## 3. Finance-related API routes

| Route | Method | Service / behaviour | Models affected | Wallet balance effects |
|-------|--------|----------------------|------------------|-------------------------|
| **/api/fortnights** | GET | listFortnightsForCatalog (when no year/month/period); else prisma.fortnight.findFirst | Fortnight (read) | None |
| **/api/fortnights/created-months** | GET | prisma.fortnight.findMany (aggregate which months have both periods) | Fortnight (read) | None |
| **/api/fortnights/create-month** | POST | resolveOrCreateFortnight (from `@/lib/fortnights`), expandExpenseTemplatesForFortnight, expandIncomeTemplatesForFortnight | Fortnight, Expense, Income, Transfer, Wallet | Only if income templates create transfers with wallets (template expansion uses null wallets for create-month) |
| **/api/fortnights/[id]/override-amount** | PUT | prisma.income.deleteMany + prisma.income.create (override marker) | Income | None |
| **/api/transactions** | GET | prisma.expense.findMany (by fortnight filters) | Expense (read) | None |
| **/api/transactions** | POST | createExpense | Expense, Wallet | Decrement if is_paid and wallet_id |
| **/api/transactions** | PUT | updateExpense | Expense, Wallet | Deltas from paid/unpaid and wallet change |
| **/api/transactions** | DELETE | prisma.expense.delete (direct) | Expense | **None – does not refund wallet** (see §7) |
| **/api/expenses/[id]/paid** | PATCH | toggleExpensePaid | Expense, Wallet | Decrement on pay, increment on unpay (when wallet_id set) |
| **/api/transfers** | GET | prisma.transfer.findMany | Transfer (read) | None |
| **/api/transfers** | POST | createUserToHouseTransfer | Transfer, Expense, Income, Wallet | User wallet decrement, house wallet increment (if provided) |
| **/api/wallets** | GET | listWallets | Wallet (read) | None |
| **/api/wallets** | POST | createWalletForDefaultUser | Wallet | Initial amount on create only |
| **/api/wallets** | PUT | updateWalletMetadata | Wallet | **None** (amount stripped in service) |
| **/api/wallets** | DELETE | deleteWalletIfUnused | Wallet | None |
| **/api/wallets/due-payments** | GET | getDuePaymentsForCurrentFortnight | Wallet, Expense, CreditCardPayment (read) | None |
| **/api/wallets/liquidity-projection** | GET | getLiquidityProjection (`until`, `omitZero`, `format=json\|csv`, `stressCyclePercent`, `includeUnpaid`, `includeTemplates`); ledger precargado para TC; log `finance.liquidity_projection.computed` | Wallet, Expense, ExpenseTemplate, Fortnight, CreditCardPayment (read) | None |
| **/api/expense-templates** | GET/POST/PUT/DELETE | prisma CRUD on ExpenseTemplate | ExpenseTemplate, Category, Wallet (read/relation) | None |
| **/api/income-templates** | GET/POST/PUT/DELETE | prisma CRUD on IncomeTemplate | IncomeTemplate | None |
| **/api/categories** | (read/CRUD) | prisma Category | Category | None |
| **/api/reports** | GET | prisma expense/income aggregates | Expense, Income, Fortnight (read) | None |
| **/api/dashboard** | GET | prisma expense/income by period | Expense, Income, Fortnight (read) | None |

---

## 4. Wallet balance mutation map

Every place where `wallet.amount` is modified:

| Location | Operation | Context | Inside transaction? | Flow |
|----------|------------|---------|---------------------|------|
| expense.service.ts | wallet.update decrement | createExpense when is_paid && wallet_id | Yes (same tx as expense create) | Expense |
| expense.service.ts | wallet.update increment/decrement | updateExpense paid/unpaid and wallet deltas | Yes (same tx as expense update) | Expense |
| expense.service.ts | wallet.update decrement/increment | toggleExpensePaid | Yes (same tx as expense update) | Expense |
| transfer.service.ts | wallet.update decrement | createUserToHouseTransferInTx (user wallet) | Yes (same tx as transfer) | Transfer |
| transfer.service.ts | wallet.update increment | createUserToHouseTransferInTx (house wallet) | Yes (same tx as transfer) | Transfer |

- **wallet.service.ts:** `updateWalletMetadata` explicitly omits `amount` (`const { amount: _ignoredAmount, ...updateFields } = data`). So PUT /api/wallets does not change balance.
- **wallet.service.ts:** `createWalletForDefaultUser` sets `amount: data.amount` only on **create** (initial balance); no ongoing balance mutations.
- **Conclusion:** All ongoing balance changes are (1) inside a Prisma transaction and (2) only via expense (paid) or transfer flows.

---

## 5. Template expansion flow: POST /api/fortnights/create-month

1. **Body:** `{ year, month }` (current year only; month ≥ current month).
2. **Default user:** First active user; required for ownership of new fortnights.
3. **Idempotency:** If both FIRST and SECOND fortnights already exist for that (year, month, user), return 409.
4. **Fortnight creation (per period):**
   - If FIRST does not exist: `resolveOrCreateFortnight({ ownerType: 'user', ownerId: defaultUser.id, year, month, period: 'FIRST', label })` (from `@/lib/fortnights`).
   - If SECOND does not exist: same with `period: 'SECOND'`.
5. **Expense template expansion (per new fortnight):**
   - For each new fortnight: `expandExpenseTemplatesForFortnight(fortnightId, period)`.
   - Inside one transaction per call: load fortnight (user_id/house_id), load templates where `active` and `applies_*_fortnight` and `category_id` set; for each template (and if wallet matches fortnight owner), create **one Expense** with `is_paid: false`, `user_id`/`house_id` from fortnight. No wallet updates.
6. **Income template expansion (per fortnight):**
   - For each new fortnight: `expandIncomeTemplatesForFortnight(fortnightId, period)`.
   - For existing fortnights (only one period existed before), also run income expansion for the existing period so “applies both” templates get income in both.
   - Inside one transaction per call: personal income template → create **Income** only. House income template → create **User→House Transfer** (Transfer + user Expense + house Income) via `createUserToHouseTransferInTx` with `userWalletId: null`, `houseWalletId: null` in create-month (no wallet changes).
7. **Response:** Created fortnights, counts of expenses/income created per period.

**Note:** Fortnight creation and each template expansion run in **separate** transactions (resolveOrCreateFortnight without tx; each expand in its own `prisma.$transaction`). The whole month creation is not one atomic transaction.

---

## 6. Transfer accounting flow: POST /api/transfers

1. **Body:** amount, user_id, house_id, user_fortnight_id, house_fortnight_id, optional user_wallet_id, house_wallet_id, note.
2. **Validation:** User and house exist; user_fortnight is user-owned (user_id, house_id null); house_fortnight is house-owned (house_id, user_id null); optional wallets belong to that user/house.
3. **Service:** `createUserToHouseTransfer(input)` → `prisma.$transaction((tx) => createUserToHouseTransferInTx(tx, input))`.
4. **Inside transaction (createUserToHouseTransferInTx):**
   - Create **Transfer** (amount, type USER_TO_HOUSE, user_id, house_id, note).
   - Create **Expense** (user side): description from note, amount, is_paid: true, payment_date, user_id, house_id: null, fortnight_id: userFortnightId, wallet_id: userWalletId.
   - Create **Income** (house side): amount, source from note, received_at, user_id: null, house_id, fortnight_id: houseFortnightId.
   - If userWalletId: **wallet.update** decrement by amount.
   - If houseWalletId: **wallet.update** increment by amount.
   - **Update Transfer** with user_expense_id and house_income_id (link accounting entries).
5. **Return:** Transfer with ids and linked expense/income.

Database links: Transfer.user_expense_id → Expense, Transfer.house_income_id → Income. Those expenses are locked (no update/paid toggle) and are the only place transfer affects wallet balance.

---

## 7. Inconsistencies and violations

### 7.1 DELETE /api/transactions bypasses service and does not refund wallet

- **Rule:** Wallet amount should only change via expense or transfer flows, and inside transactions.
- **Current behaviour:** `DELETE /api/transactions` calls `prisma.expense.delete` directly. It does not:
  - Use expense.service (e.g. a hypothetical `deleteExpense` that refunds wallet when expense is paid).
  - Refund the wallet when the deleted expense was paid and had a wallet_id.
- **Effect:** Deleting a paid expense leaves wallet balance too low (money “disappears” from the wallet).
- **Recommendation:** Introduce `deleteExpense` in expense.service that (inside a transaction) refunds wallet if expense was paid and had wallet_id, then deletes the expense; forbid deletion of transfer-linked expenses. Use this from DELETE /api/transactions.

### 7.2 Override amount uses Income without finance service

- **Current behaviour:** PUT `/api/fortnights/[id]/override-amount` creates/deletes Income rows with `source: '__OVERRIDE__'` via prisma directly. No wallet or other balance is affected.
- **Assessment:** By design for reporting (“Tenemos” override). Not a wallet-integrity issue; could be documented as the single allowed direct Income write outside the service if desired.

### 7.3 create-month not a single atomic transaction

- **Current behaviour:** Fortnight creation and each template expansion run in separate transactions. If a later step fails, earlier steps are already committed.
- **Assessment:** Behavioural choice (e.g. partial progress). Not a violation of “wallet only in expense/transfer” or “only in transactions”; each expansion that touches wallets does so inside its own transaction.

### 7.4 Summary

| Rule | Status |
|------|--------|
| wallet.amount updated only inside transactions | ✅ All mutations are inside Prisma transactions. |
| wallet.amount updated only via expense or transfer flows | ✅ Only expense.service and transfer.service mutate balance. |
| Expense owner derived from fortnight | ✅ createExpense/updateExpense and template expansion use fortnight.user_id / house_id. |
| Template expansion does not create paid expenses | ✅ expandExpenseTemplatesForFortnight uses is_paid: false. |
| Transfers are atomic | ✅ createUserToHouseTransfer runs in a single prisma.$transaction. |
| API routes use service layer for mutations | ❌ DELETE /api/transactions bypasses service and does not refund wallet. |

---

*Document generated from the codebase as of the finance refactor and deterministic fortnight lifecycle implementation.*
