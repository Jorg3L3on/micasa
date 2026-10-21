import type { McpServer } from '@modelcontextprotocol/server';
import { registerCardReadTools } from '@/lib/mcp/tools/credit-cards/read';
import { registerCardWriteTools } from '@/lib/mcp/tools/credit-cards/write';

export function registerCreditCardTools(server: McpServer) {
  registerCardReadTools(server);
  registerCardWriteTools(server);
}
