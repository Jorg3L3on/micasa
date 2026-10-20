# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **MCP connector OAuth hardening (MIC-I5, `serverInfo` 2.2.1)** — fixes from the October 2026 audit:
  - PKCE `S256` is mandatory on every code exchange; a `client_assertion` can no longer stand in for the `code_verifier`, and a different CIMD `client_id` can no longer redeem another client's code. `private_key_jwt` is retired (assertions are ignored).
  - Authorization codes are single-use atomically; replaying a code revokes the grants issued from it.
  - Per-IP rate limits on `/api/oauth/token`, `/api/oauth/register` and new CIMD client resolution; token endpoint preflights no longer write to the database.
  - Dynamic client registration only accepts https, loopback http or reverse-DNS private-scheme redirect URIs, and https `client_uri` / `logo_uri`; the consent screen shows the client's origin.
  - Token audience (RFC 8707) is verified on `/api/mcp`, foreign `resource` values get `invalid_target`, access tokens last 24 h, refresh tokens expire after 365 days with reuse detection, consent POST requires same-origin, and the 401 challenge no longer follows the `Host` header.
  - Requires migrations `20261020120000_mcp_oauth_grant_authorization_code` and `20261020130000_mcp_oauth_refresh_lifetime`.

### Added

- **Loans (Préstamos)** — `Loan` and `LoanPayment` models, payment schedules, planner panel, wallet linking, and integration with dashboard obligations, liquidity projection, and transactions.
- **Expense ↔ loan payment link** — optional `Expense.loan_payment_id` when a wallet-paid installment is recorded as an expense.
- **Recurrent budgets** and **budget periods**.
- **Category icons** (`Category.icon`) with `CategoryLabel` in UI and API.
- **DiDi Card** statement import parser and temporary credit limits on wallets.
- Pantry **expense ↔ receipt linking**; wallet assignees, filtering, and sorting.

### Changed

- Dashboard and monthly views: compact fortnight KPIs, tooltip navigation, hardened monthly route loading.
- Credit card statement import error handling (`NoMovementsStatementImportError` and user-facing hints).
- Sidebar navigation order and contributing/agent workflow docs.
- **Orion dark UI** encoded as a design system: [`DESIGN.md`](./DESIGN.md), Cursor rules, dashboard-ui skill, and README screenshots of the live landing, login, and Panel financiero (no third-party mockups in the repo).

### Fixed

- Credit card next-due payment calculation on statement views.
- Wallet detail loading and error states.

## [0.1.0] - 2026-05-05

### Added

- Initial public baseline for MiCasa with fortnight-first personal and household finance workflows.
- Core app architecture across Next.js App Router pages, API routes, Prisma-backed domain services, and owner-context scoping.
- CI validation pipeline with Prisma client generation, dashboard UI rule validation, unit tests, and production build checks.
- Open-source baseline docs including a complete project README and MIT license.
