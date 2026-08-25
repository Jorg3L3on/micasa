import type { McpServer } from '@modelcontextprotocol/server';
import { registerHouseTools } from '@/lib/mcp/tools/houses';
import { registerWalletTools } from '@/lib/mcp/tools/wallets';
import { registerCreditCardTools } from '@/lib/mcp/tools/credit-cards';
import { registerLoanTools } from '@/lib/mcp/tools/loans';
import { registerCategoryTools } from '@/lib/mcp/tools/categories';
import { registerExpenseTools } from '@/lib/mcp/tools/expenses';
import { registerIncomeTools } from '@/lib/mcp/tools/incomes';
import { registerTransferTools } from '@/lib/mcp/tools/transfers';
import { registerGoalTools } from '@/lib/mcp/tools/goals';
import { registerPlanningTools } from '@/lib/mcp/tools/planning';
import { registerLiquidityTools } from '@/lib/mcp/tools/liquidity';
import { registerFortnightTools } from '@/lib/mcp/tools/fortnights';
import { registerBudgetTools } from '@/lib/mcp/tools/budgets';

/**
 * MCP connector v2: v1 reads/writes for cards plus expenses, incomes, loans,
 * transfers, goals, budgets, planning and liquidity. Auth is per-tool via Bearer
 * agent token (see `resolveAgentContext`).
 */
export function registerMcpTools(server: McpServer) {
  registerHouseTools(server);
  registerWalletTools(server);
  registerCreditCardTools(server);
  registerLoanTools(server);
  registerCategoryTools(server);
  registerExpenseTools(server);
  registerIncomeTools(server);
  registerTransferTools(server);
  registerGoalTools(server);
  registerPlanningTools(server);
  registerLiquidityTools(server);
  registerFortnightTools(server);
  registerBudgetTools(server);
}
