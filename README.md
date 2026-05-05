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

- Fortnight-first planning for expenses, incomes, and budget allocation.
- Dashboard with monthly and period summaries, chart insights, and liquidity visibility.
- Multi-context ownership model (user vs house) with role-based house membership.
- Wallet and transfer management across payment method types.
- Credit card and department-store card statement workflows.
- Pantry receipt and product insights.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: PostgreSQL with Prisma 7
- **Auth**: NextAuth v5 (JWT strategy)
- **UI**: Tailwind CSS v4, Radix UI, shadcn patterns
- **Validation and Forms**: Zod v4, react-hook-form
- **Tables and Charts**: TanStack Table, Recharts
- **Testing**: Vitest

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
- `src/lib`: domain services, utilities, API helpers, server modules
- `src/schemas`: Zod schemas per resource
- `prisma`: Prisma schema, migrations, and seed script

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
- GitHub releases: `https://github.com/<owner>/<repo>/releases`

## Roadmap

Planned open-source improvements:

- Expanded docs (contributing guide, security policy, architecture diagrams)
- Release automation and changelog generation
- More coverage for finance domain services and API routes
- Public demo and feature screenshots

## Contributing

Contributions are welcome. For now:

1. Open an issue describing the bug/feature.
2. Create a branch with focused changes.
3. Run `npm run ci` before opening a pull request.

A dedicated `CONTRIBUTING.md` will be added in the next docs pass.

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE) for details.
