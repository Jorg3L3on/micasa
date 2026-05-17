# Domain docs (Micasa)

## Layout

- **CLAUDE.md** / **AGENTS.md** — architecture, commands, patterns (read first)
- **`prisma/schema.prisma`** — data model
- **`docs/adr/`** — add ADRs when decisions are recorded (optional)

## Before implementing

1. Read **CLAUDE.md** (or AGENTS.md)
2. Skim **prisma/schema.prisma** for models you touch
3. Use **`getOwnerContext`** in API routes; scope with `ownerFilter` (user vs house)

## Vocabulary

| Term | Meaning |
| ---- | ------- |
| **Fortnight** | Planning period: `FIRST` (1–15) or `SECOND` (16–EOM) |
| **House** | Shared household; resources can be house-scoped |
| **Owner context** | Active `user` or `house` via finance context + API params |
| **Wallet** | Account; `PaymentMethodType` drives cash vs credit behavior |
| **Expense** | Spend; installment (cuota) expenses follow statement cycle, not fortnight aggregates |
| **Fortnight view** | `/fortnight/...` — primary money planning UI |

Use these terms in issue titles and acceptance criteria.

## Verify commands

```bash
npm run lint
npm test
npm run build
```

Full CI: `npm run ci` (dashboard UI validate + prisma generate + test + build).

## Schema changes

After `prisma/schema.prisma` edits: `npx prisma migrate dev --name <name>` and `npx prisma generate`. Import client from `@/lib/prisma` / `src/generated/prisma`.

## Flag conflicts

If work contradicts CLAUDE.md/AGENTS.md rules (owner scoping, fortnight accounting, wallet types), call it out explicitly.
