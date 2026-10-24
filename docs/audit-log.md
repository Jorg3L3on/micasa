# Audit log (Actividad)

Who changed what, and who signed in. Two append-only tables, written in the same
database as the data they describe.

| Table | Written by | What |
|---|---|---|
| `AuditLog` | Postgres trigger `audit.row_change()` | Every insert, update and delete on the audited finance tables, with before / after, changed fields, owner, actor, session and batch |
| `AuthEvent` | The app (`recordAuthEvent`) | Logins, failed logins, logouts, registration, password changes, API key and OAuth grant lifecycle, rejected agent tokens |

Users read them in **Configuración → Actividad** (`/settings/activity`) and from
**Historial** on expenses, wallets, loans and budgets. Admins read every tenant in
`/admin/audit`. PRD: Plania doc "PRD: Audit log (Actividad)". Spike and the choice
of capture mechanism: [`audit-spike.md`](audit-spike.md).

## How a change gets its actor

1. An entry point opens the actor scope (AsyncLocalStorage, `src/lib/server/audit/audit-context.ts`):
   - API routes: `withOwnerContext` (owner routes), `withSessionActor` (account, houses, onboarding), `withAdmin` (admin API). Register sets the actor itself.
   - Server components that write while loading: `withPageActor` (Panel financiero).
   - MCP tools: `runAgentTool` / `runAgentUserTool` (source `AGENT`, API key or OAuth grant).
   - Seed and scripts: `runWithAuditActor({ source: 'SYSTEM', label })`.
2. `src/lib/prisma.ts` wraps the client (`prisma-audit-layer.ts`): every `$transaction`
   first runs `set_config('micasa.audit_actor', <json>, true)`, and a standalone write
   to an audited model runs in its own transaction that does the same. The `tx` client
   is never wrapped.
3. The trigger reads the setting. No setting (Neon console, MCP `run_sql`, a script
   without a scope) is recorded as `SYSTEM` with `metadata.missing_actor` and the
   label "Fuera de la app", never rejected.

Outside production an audited write with no actor throws `AuditActorMissingError`;
in production it is written as missing-actor and logs `audit.actor_missing`.

Batches: rows of one request share `batch_id`; `setAuditLabel()` names the batch
(statement import, rollback, onboarding, create-month, regenerate-from-templates).

## Adding or changing a model

- Add it to `AUDITED_MODELS` (owner mode, label column, extra denied columns) or to
  `EXCLUDED_MODELS` with the reason, in `src/lib/server/audit/audited-models.ts`.
- New audited model: `npm run generate:audit-triggers -- <migration_name>` writes a
  migration with the function and every trigger. Add its Spanish labels and field
  kinds in `src/lib/audit/labels.ts`.
- `npm run validate:audit-coverage` (in `npm run ci`) fails when a model is in neither
  list, a mutating route opens no actor scope, `$executeRaw` runs outside a
  transaction, or the actor setting is set at session level.
- `npm run test:db` (DATABASE_URL must be a local Postgres) checks that the installed
  triggers equal the generated list, plus the trigger, layer, import and read tests.

Data migrations that change audited tables should begin with
`SELECT set_config('micasa.audit_actor', '{"v":1,"source":"SYSTEM","label":"migration"}', true);`
inside their transaction so their rows are labelled instead of "Fuera de la app".

## Privacy

- Secrets never reach a row: the trigger drops any column matching
  `password|hash|secret|token`, `User` keeps only name, email, active and is_admin,
  and `CreditCardStatementImport.file_data` is excluded.
- `AuthEvent` stores the browser and OS family, never the raw user agent, never the
  typed password, and never an email that does not belong to a user.
- House context shows every member's logins, logouts and failed attempts; token and
  password events stay personal (account context). Failures on unknown emails only
  appear in `/admin/audit`.

## AdminAuditLog (deprecated)

`AdminAuditLog` predates this log and only recorded the admin password override.
That action now also writes `AuthEvent` `PASSWORD_OVERRIDDEN` (and keeps writing the
old table). `/admin/audit` shows the old rows merged as ADMIN changes. Do not add new
writers; removing the table is a separate ticket.

## Rollout

1. Apply the migration `20261023062552_audit_log` (tables, enums, `audit` schema,
   function and triggers) before deploying the code that sets the actor.
2. The record starts on the go-live date; existing rows get no synthetic history.
