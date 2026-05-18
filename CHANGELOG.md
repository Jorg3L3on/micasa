# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed

- Credit card next-due payment calculation on statement views.
- Wallet detail loading and error states.

## [0.1.0] - 2026-05-05

### Added

- Initial public baseline for MiCasa with fortnight-first personal and household finance workflows.
- Core app architecture across Next.js App Router pages, API routes, Prisma-backed domain services, and owner-context scoping.
- CI validation pipeline with Prisma client generation, dashboard UI rule validation, unit tests, and production build checks.
- Open-source baseline docs including a complete project README and MIT license.
