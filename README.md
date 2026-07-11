# MiCasa

MiCasa is a personal and household finance manager focused on biweekly planning.  
It helps you organize incomes, expenses, budgets, wallets, and card activity by fortnight so you can plan cash flow with more precision.

## Table of Contents

- [Why MiCasa](#why-micasa)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Project Architecture](#project-architecture)
- [Quality and CI](#quality-and-ci)
- [Releases](#releases)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Why MiCasa

Most budgeting apps treat months as a single block. MiCasa uses **fortnights** (`FIRST`: days 1-15, `SECOND`: days 16-end) as the core planning unit, which better matches real-life pay cycles and recurring obligations.

MiCasa also supports both individual and shared household contexts, so financial data can belong to a single user or a house.

## Core Features

- **Fortnight-first planning** for expenses, incomes, and budget allocation (recurrent budgets and budget periods).
- **Dashboard** with monthly and period summaries, chart insights, liquidity projection (~180 days), and upcoming obligations (cards and loans).
- **Multi-context ownership** (user vs house) with role-based house membership (`OWNER`, `ADMIN`, `MEMBER`).
- **Wallets and transfers** across payment method types (cash, debit, credit, department-store cards).
- **Credit cards** — statement cycles, payments, imports (Mercado Pago, CA Departamental, CA Efectivo, DiDi Card) with rollback.
- **Loans (Préstamos)** — schedules, wallet or payroll payment sources, integration with expenses, liquidity, dashboard, and transactions.
- **Pantry** — receipt upload, product catalog, shopping carts, expense ↔ receipt linking.
- **Tasks** — lists, habits, routines (household productivity alongside finance).
- **Categories** with optional icons across expense UI and API.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: PostgreSQL with Prisma 7
- **Auth**: NextAuth v5 (JWT strategy)
- **UI**: Tailwind CSS v4, Radix UI, shadcn patterns
- **Validation and Forms**: Zod v4, react-hook-form
- **Tables and Charts**: TanStack Table, Recharts
- **Testing**: Vitest

## Contributing & AI workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/agents/workflow.md](docs/agents/workflow.md) for PR checks and Cursor skills (`/ship-feature`, `/prd`).

## Getting Started

### 1) Clone and install

```bash
git clone <your-repo-url>
cd micasa
npm install
```

### 2) Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="replace-with-a-strong-secret"
NEXTAUTH_URL="http://localhost:3000"
```

### 3) Generate Prisma client

```bash
npx prisma generate
```

### 4) Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: NextAuth signing secret
- `NEXTAUTH_URL`: Base URL for auth callbacks and session behavior
- `UPSTASH_REDIS_REST_URL` (optional): Upstash Redis REST URL for distributed rate limiting in production
- `UPSTASH_REDIS_REST_TOKEN` (optional): Upstash Redis REST token; omit both Upstash vars for in-memory limiting in local dev

## Available Scripts

- `npm run dev`: start local development server (webpack mode)
- `npm run dev:turbo`: start local development server (Turbopack mode)
- `npm run build`: production build
- `npm run start`: run production server
- `npm run lint`: run ESLint
- `npm test`: run Vitest test suite (`vitest run`)
- `npm run validate:dashboard-ui`: validate dashboard metric strip consistency rules
- `npm run backfill:pantry-products`: backfill pantry products from receipt lines
- `npm run ci`: run local CI pipeline (`validate:dashboard-ui`, `prisma generate`, tests, build)

## Project Architecture

High-level flow:

1. Server-rendered pages and layouts fetch from API routes.
2. Client-side mutations use typed fetch helpers in `src/lib/api`.
3. Route handlers validate payloads with Zod schemas.
4. Prisma queries are scoped through owner context (`user` or `house`).

Important directories:

- `src/app`: App Router pages and route handlers
- `src/components`: UI and feature components
- `src/lib/finance`: domain services (expenses, wallets, loans, liquidity projection, etc.)
- `src/lib/server`: owner context, statement import parsers, pantry processing
- `src/schemas`: Zod schemas per resource
- `prisma`: Prisma schema (~31 models), migrations, and seed script

Further reading: [`docs/finance-architecture.md`](docs/finance-architecture.md), [`docs/finance-invariants.md`](docs/finance-invariants.md), [`docs/agents/domain.md`](docs/agents/domain.md).

Core domain concept:

- `FortnightPeriod.FIRST`: day 1-15
- `FortnightPeriod.SECOND`: day 16-end of month

## Quality and CI

GitHub Actions runs CI on push to `main`/`master` and on pull requests with these checks:

- Prisma client generation
- Dashboard UI consistency validation
- Unit tests
- Next.js production build

Before opening a PR, run:

```bash
npm run ci
```

## Releases

- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)
- Release checklist: [`docs/release-process.md`](./docs/release-process.md)
- GitHub releases: `https://github.com/Jorg3L3on/micasa/releases`

## Roadmap

Near-term focus:

- Harden loan ↔ expense sync and liquidity edge cases.
- More test coverage for finance services and API routes.
- Security policy and architecture diagrams for contributors.
- Public demo assets and screenshots.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, PR checks, and the **Cursor agent workflow** (`/ship-feature`, `/prd`).

1. Open an issue describing the bug or feature.
2. Create a focused branch (`feat/<slug>` per [docs/agents/deployment.md](docs/agents/deployment.md)).
3. Run `npm run ci` before opening a pull request.

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE) for details.
