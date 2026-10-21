import type { AuthInfo, McpServer } from '@modelcontextprotocol/server';
import { connectInMemoryMcp } from '@/lib/mcp/testing/in-memory-client';

/**
 * Shared setup for the write-tool behavior tests (`*.behavior.test.ts`): a
 * credential already verified by the transport (no token lookup) for user 2,
 * acting on house 42. Each test file mocks `@/lib/prisma` at the data level
 * and must answer `houseMember.findFirst` and
 * `agentConnectionAllowedContext.findMany` (see `authPrismaMocks`).
 */

export const HOUSE_ID = 42;
export const USER_ID = 2;
export const HOUSE = { owner_type: 'house' as const, owner_id: HOUSE_ID };
export const HOUSE_FILTER = { user_id: null, house_id: HOUSE_ID };

export const stampedAuthInfo: AuthInfo = {
  token: 'micasa_token-verificado-por-el-transporte',
  clientId: 'api-key:10',
  scopes: ['read', 'write'],
  extra: {
    micasa_agent: {
      userId: USER_ID,
      scopes: ['read', 'write'],
      authSource: 'api_key',
      apiKeyId: 10,
      rateLimitIdentity: 10,
    },
  },
};

/** Default answers for the owner-context queries every tool call makes. */
export const authPrismaMocks = {
  membership: { role: 'OWNER' },
  allowedContexts: [
    { owner_type: 'USER', owner_id: USER_ID },
    { owner_type: 'HOUSE', owner_id: HOUSE_ID },
  ],
};

export type BehaviorResult = {
  isError?: boolean;
  body: Record<string, unknown>;
};

/** Calls one tool through the real MCP pipeline and parses its JSON body. */
export async function callTool(
  register: (server: McpServer) => void,
  name: string,
  args: Record<string, unknown>,
): Promise<BehaviorResult> {
  const client = await connectInMemoryMcp(register, { authInfo: stampedAuthInfo });
  try {
    const result = await client.callTool(name, args);
    return { isError: result.isError, body: JSON.parse(result.content[0]!.text) };
  } finally {
    await client.close();
  }
}
