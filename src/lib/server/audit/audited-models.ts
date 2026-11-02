/**
 * Single source of truth for the audit log.
 *
 * Every model listed in `AUDITED_MODELS` gets an `AuditRowChange` trigger that
 * runs `audit.row_change()` (see `audit-sql.ts`). Every other model in
 * `prisma/schema.prisma` that is owner-scoped must appear in `EXCLUDED_MODELS`
 * with the reason; `npm run validate:audit-coverage` enforces both lists.
 *
 * After changing either list, regenerate the trigger migration:
 *   npm run generate:audit-triggers -- <migration_name>
 */

export type AuditOwnerMode =
  /** Row has `user_id` / `house_id`; `house_id` wins when both are set. */
  | { kind: 'self' }
  /** Owner comes from a parent row (one lookup through `fk`). */
  | { kind: 'parent'; model: string; fk: string }
  /** The row is the house itself. */
  | { kind: 'house' }
  /** The row is the user itself. */
  | { kind: 'user' }

export type AuditedModel = {
  /** Prisma model name; also the table name (no `@@map` in this schema). */
  model: string
  owner: AuditOwnerMode
  /** Column snapshotted as `entity_label` (e.g. an expense description). */
  labelColumn: string | null
  /** Only these columns ever reach `before` / `after`. */
  allowColumns?: readonly string[]
  /** Extra columns stripped on top of the global secret denylist. */
  denyColumns?: readonly string[]
}

const self = { kind: 'self' } as const

export const AUDITED_MODELS: readonly AuditedModel[] = [
  { model: 'Expense', owner: self, labelColumn: 'description' },
  { model: 'Income', owner: self, labelColumn: 'source' },
  { model: 'ExpenseTemplate', owner: self, labelColumn: 'name' },
  { model: 'IncomeTemplate', owner: self, labelColumn: 'name' },
  { model: 'Category', owner: self, labelColumn: 'name' },
  { model: 'Wallet', owner: self, labelColumn: 'name' },
  { model: 'WalletTransfer', owner: self, labelColumn: 'note' },
  { model: 'Transfer', owner: self, labelColumn: 'note' },
  { model: 'Budget', owner: self, labelColumn: 'name' },
  { model: 'BudgetPeriod', owner: { kind: 'parent', model: 'Budget', fk: 'budget_id' }, labelColumn: null },
  { model: 'BudgetAllocation', owner: { kind: 'parent', model: 'Budget', fk: 'budget_id' }, labelColumn: null },
  { model: 'CreditCardPayment', owner: self, labelColumn: 'note' },
  { model: 'CreditCardPaymentPlan', owner: self, labelColumn: null },
  { model: 'CreditCardScheduledPayment', owner: self, labelColumn: 'label' },
  { model: 'CreditCardInstallmentPlan', owner: self, labelColumn: 'name' },
  {
    model: 'CreditCardInstallmentPlanPayment',
    owner: { kind: 'parent', model: 'CreditCardInstallmentPlan', fk: 'plan_id' },
    labelColumn: null,
  },
  {
    model: 'CreditCardStatementImport',
    owner: self,
    labelColumn: 'file_name',
    // The uploaded PDF; megabytes of base64 with no audit value.
    denyColumns: ['file_data'],
  },
  { model: 'Loan', owner: self, labelColumn: 'name' },
  { model: 'LoanPayment', owner: { kind: 'parent', model: 'Loan', fk: 'loan_id' }, labelColumn: null },
  { model: 'Lender', owner: self, labelColumn: 'name' },
  { model: 'LenderPayment', owner: self, labelColumn: 'note' },
  { model: 'House', owner: { kind: 'house' }, labelColumn: 'name' },
  { model: 'HouseMember', owner: self, labelColumn: null },
  { model: 'Fortnight', owner: self, labelColumn: 'label' },
  {
    model: 'User',
    owner: { kind: 'user' },
    labelColumn: 'name',
    allowColumns: ['name', 'email', 'active', 'is_admin'],
  },
]

/** Models deliberately not audited, with the reason. */
export const EXCLUDED_MODELS: Readonly<Record<string, string>> = {
  ApiKey: 'Lifecycle recorded as AuthEvent (API_KEY_*); token values are never stored',
  McpOAuthClient: 'OAuth client registration, not household data; grants are recorded as AuthEvent',
  McpOAuthAuthorizationCode: 'Short-lived OAuth code; the resulting grant is recorded as AuthEvent',
  McpOAuthAuthorizationCodeContext: 'Short-lived OAuth code scope; the resulting grant is recorded as AuthEvent',
  McpOAuthGrant: 'Lifecycle recorded as AuthEvent (OAUTH_GRANT_*); token values are never stored',
  McpOAuthTokenAttempt: 'Diagnostics for the OAuth token endpoint',
  AgentConnectionAllowedContext: 'Part of the API key / OAuth grant lifecycle recorded as AuthEvent',
  AdminAuditLog: 'Older admin audit trail, folded into /admin/audit',
  AuditLog: 'The audit log itself',
  AuthEvent: 'Auth events are their own append-only log',
  BudgetPeriodSnapshot: 'Derived copy written when a budget period closes; the budget and its period are audited',
  BudgetPeriodSnapshotAllocation: 'Derived copy written when a budget period closes; the allocations are audited',
}

export const AUDITED_MODEL_NAMES: ReadonlySet<string> = new Set(AUDITED_MODELS.map((m) => m.model))

/** Columns no audit row may ever contain, matched case-insensitively. */
export const SECRET_COLUMN_PATTERN = 'password|hash|secret|token'

/** Label of rows written without an actor (console, MCP `run_sql`, scripts). */
export const OUTSIDE_APP_LABEL = 'Fuera de la app'

export const ownerModeArg = (owner: AuditOwnerMode): string => {
  switch (owner.kind) {
    case 'self':
      return 'self'
    case 'parent':
      return `parent:${owner.model}:${owner.fk}`
    case 'house':
      return 'house:id'
    case 'user':
      return 'user:id'
  }
}

/** Arguments passed to `audit.row_change()` for one model, in order. */
export const triggerArgs = (m: AuditedModel): [string, string, string, string, string] => [
  m.model,
  ownerModeArg(m.owner),
  m.labelColumn ?? '',
  (m.allowColumns ?? []).join(','),
  (m.denyColumns ?? []).join(','),
]
