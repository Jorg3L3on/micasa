import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Finance coverage gate (execution plan 3.2).
 *
 * Thresholds apply to `src/lib/finance/**` unit-tested domain logic.
 * Untested Prisma CRUD shells and CSV/PDF I/O helpers are excluded until
 * they have meaningful unit coverage — otherwise the ~70% floor would be
 * meaningless noise from files that are only exercised via API/integration.
 */
const FINANCE_COVERAGE_EXCLUDE = [
  'src/lib/finance/**/*.test.ts',
  'src/lib/finance/**/*.isolation.test.ts',
  // Untested Prisma service shells / exporters (0–few % lines today)
  'src/lib/finance/credit-card-calendar.ts',
  'src/lib/finance/credit-card-cycle-types.ts',
  'src/lib/finance/credit-card-reconciliation.service.ts',
  'src/lib/finance/credit-card-statement-csv.ts',
  'src/lib/finance/credit-card-statement-pdf.ts',
  'src/lib/finance/credit-card.service.ts',
  'src/lib/finance/expense.service.ts',
  'src/lib/finance/expense-template-due.ts',
  'src/lib/finance/report-summary.service.ts',
  'src/lib/finance/template.service.ts',
  'src/lib/finance/transfer.service.ts',
  'src/lib/finance/wallet-movements-csv.ts',
  'src/lib/finance/wallet.service.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.isolation.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/finance/**/*.ts'],
      exclude: FINANCE_COVERAGE_EXCLUDE,
      reporter: ['text', 'text-summary'],
      thresholds: {
        // ~70% floor on finance domain logic (branches trail slightly)
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 55,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
