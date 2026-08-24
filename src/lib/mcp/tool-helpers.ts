import { z } from 'zod';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import { checkRateLimit } from '@/lib/server/rate-limit';
import {
  AgentAuthError,
  assertScope,
  resolveAgentContext,
  resolveAgentUser,
  parseBearerToken,
  type AgentContext,
  type AgentScope,
} from '@/lib/server/resolve-agent-context';

/** Structural view of the SDK's ServerContext — only what the tools need. */
export type McpToolContext = {
  http?: { req?: Request };
};

export const ownerTypeSchema = z
  .enum(['user', 'house'])
  .describe(
    'Contexto financiero: "user" (finanzas personales) o "house" (casa compartida). Usa list_houses primero para descubrir los ids.',
  );

export const ownerIdSchema = z
  .number()
  .int()
  .positive()
  .describe('Id del usuario (ownerType=user) o de la casa (ownerType=house).');

export const confirmSchema = z
  .literal(true)
  .describe(
    'Confirmación explícita requerida: esta operación modifica saldos o elimina datos.',
  );

type McpTextResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export const jsonResult = (data: unknown): McpTextResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

export const errorResult = (message: string): McpTextResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  isError: true,
});

const getAuthorizationHeader = (ctx: McpToolContext): string | null =>
  ctx.http?.req?.headers.get('authorization') ?? null;

/**
 * Per-key rate limit (policy `mcp:tool`). The api key id is the identity so
 * one runaway agent cannot starve other connections of the same user.
 * Returns an error result when limited, otherwise null.
 */
const enforceToolRateLimit = async (
  ctx: McpToolContext,
  apiKeyId: number,
): Promise<McpTextResult | null> => {
  const request = ctx.http?.req;
  if (!request) return null;
  const { limited, retryAfterSeconds } = await checkRateLimit(
    request,
    'mcp:tool',
    apiKeyId,
  );
  if (!limited) return null;
  return errorResult(
    `Límite de solicitudes alcanzado para esta conexión. Reintenta en ${retryAfterSeconds}s.`,
  );
};

const toErrorResult = (error: unknown): McpTextResult => {
  if (error instanceof AgentAuthError) {
    return errorResult(error.message);
  }
  if (error instanceof z.ZodError) {
    const details = error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return errorResult(`Error de validación: ${details}`);
  }
  if (error instanceof Error && error.message) {
    return errorResult(error.message);
  }
  return errorResult('Error interno en la herramienta');
};

/**
 * Runs an owner-scoped MCP tool: resolves the agent token from the
 * Authorization header, enforces the scope, resolves the owner context
 * (house membership / self), executes and serializes.
 */
export async function runAgentTool(
  toolName: string,
  ctx: McpToolContext,
  args: { ownerType: 'user' | 'house'; ownerId: number },
  scope: AgentScope,
  fn: (agent: AgentContext) => Promise<unknown>,
): Promise<McpTextResult> {
  try {
    const agent = await resolveAgentContext(
      getAuthorizationHeader(ctx),
      args.ownerType,
      args.ownerId,
    );
    assertScope(agent, scope);

    const limitedResult = await enforceToolRateLimit(ctx, agent.apiKeyId);
    if (limitedResult) return limitedResult;

    const data = await fn(agent);

    logFinanceEvent('info', 'mcp.tool.invoked', {
      tool: toolName,
      owner_type: agent.ownerType,
      owner_id: agent.ownerId,
      api_key_id: agent.apiKeyId,
      scope,
    });

    return jsonResult(data);
  } catch (error) {
    logFinanceEvent('warn', 'mcp.tool.failed', {
      tool: toolName,
      owner_type: args.ownerType,
      owner_id: args.ownerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return toErrorResult(error);
  }
}

/**
 * Runs a tool that only needs the token user (no owner args), e.g.
 * `list_houses` — the discovery entry point.
 */
export async function runAgentUserTool(
  toolName: string,
  ctx: McpToolContext,
  fn: (user: { userId: number; scopes: AgentScope[] }) => Promise<unknown>,
): Promise<McpTextResult> {
  try {
    const token = parseBearerToken(getAuthorizationHeader(ctx));
    const user = await resolveAgentUser(token);

    const limitedResult = await enforceToolRateLimit(ctx, user.apiKeyId);
    if (limitedResult) return limitedResult;

    const data = await fn(user);

    logFinanceEvent('info', 'mcp.tool.invoked', {
      tool: toolName,
      user_id: user.userId,
      api_key_id: user.apiKeyId,
    });

    return jsonResult(data);
  } catch (error) {
    logFinanceEvent('warn', 'mcp.tool.failed', {
      tool: toolName,
      error: error instanceof Error ? error.message : String(error),
    });
    return toErrorResult(error);
  }
}
