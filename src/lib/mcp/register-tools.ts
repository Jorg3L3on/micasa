import type { McpServer } from '@modelcontextprotocol/server';
import { registerHouseTools } from '@/lib/mcp/tools/houses';
import { registerWalletTools } from '@/lib/mcp/tools/wallets';
import { registerCreditCardTools } from '@/lib/mcp/tools/credit-cards';
import { registerLoanTools } from '@/lib/mcp/tools/loans';
import { registerCategoryTools } from '@/lib/mcp/tools/categories';
import { registerExpenseTools } from '@/lib/mcp/tools/expenses';
import { registerIncomeTools } from '@/lib/mcp/tools/incomes';
import { registerTransferTools } from '@/lib/mcp/tools/transfers';
import { registerPlanningTools } from '@/lib/mcp/tools/planning';
import { registerLiquidityTools } from '@/lib/mcp/tools/liquidity';
import { registerFortnightTools } from '@/lib/mcp/tools/fortnights';
import { registerBudgetTools } from '@/lib/mcp/tools/budgets';
import { registerTemplateTools } from '@/lib/mcp/tools/templates';
import { registerReportTools } from '@/lib/mcp/tools/reports';
import { registerDeleteTools } from '@/lib/mcp/tools/delete';

/**
 * MCP connector v3: 41 tools (see docs/mcp-connector.md for the v2 → v3
 * replacement table). Every tool registers through `defineOwnerTool` /
 * `defineUserTool`.
 * The transport verifies the Bearer token once per request (`withMcpAuth`);
 * tools reuse that identity via `ctx.http.authInfo` (see `runAgentTool`).
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
  registerPlanningTools(server);
  registerLiquidityTools(server);
  registerFortnightTools(server);
  registerBudgetTools(server);
  registerTemplateTools(server);
  registerReportTools(server);
  registerDeleteTools(server);
}
