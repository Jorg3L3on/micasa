import type { McpServer } from '@modelcontextprotocol/server';
import { registerHouseTools } from '@/lib/mcp/tools/houses';
import { registerWalletTools } from '@/lib/mcp/tools/wallets';
import { registerCreditCardTools } from '@/lib/mcp/tools/credit-cards';
import { registerLoanTools } from '@/lib/mcp/tools/loans';

/**
 * MCP connector v1 (Grok Bot / Cursor): reads (houses, wallets, cards, loans)
 * plus the card writes proven useful in practice. Auth is per-tool via the
 * Bearer agent token (see `resolveAgentContext`); wallet-funded card payments,
 * statement imports and admin stay out of this surface.
 */
export function registerMcpTools(server: McpServer) {
  registerHouseTools(server);
  registerWalletTools(server);
  registerCreditCardTools(server);
  registerLoanTools(server);
}
