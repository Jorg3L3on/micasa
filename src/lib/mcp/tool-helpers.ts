import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import { checkRateLimit } from '@/lib/server/rate-limit';
import {
  AgentAuthError,
  assertScope,
  loadAllowedContextsForIdentity,
  parseBearerToken,
  resolveAgentContextForIdentity,
  resolveAgentIdentity,
  type AgentContext,
  type AgentIdentity,
  type AgentScope,
} from '@/lib/server/resolve-agent-context';
import { MCP_AGENT_IDENTITY_KEY } from '@/lib/server/mcp-bearer-auth';
import { AssigneeInvalidError } from '@/lib/server/house-members';
import { CategoryServiceError } from '@/lib/finance/category.service';
import { IncomeServiceError } from '@/lib/finance/income.service';
import {
  codeForStatus,
  McpToolError,
  type McpErrorPayload,
} from '@/lib/mcp/errors';
import type { AgentContextEntry } from '@/schemas/agent-context.schema';

/** Structural view of the SDK's ServerContext — only what the tools need. */
export type McpToolContext = {
  http?: { req?: Request; authInfo?: AuthInfo };
};

type McpTextResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export const jsonResult = (data: unknown): McpTextResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

const errorPayloadResult = (payload: McpErrorPayload): McpTextResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  isError: true,
});

/**
 * Owner args: `defineOwnerTool` normalizes the v2 camelCase alias to
 * snake_case; direct callers (tests) may still pass camelCase.
 */
type OwnerToolArgs =
  | { owner_type: 'user' | 'house'; owner_id: number }
  | { ownerType: 'user' | 'house'; ownerId: number };

const readOwnerArgs = (args: OwnerToolArgs) =>
  'owner_type' in args
    ? { ownerType: args.owner_type, ownerId: args.owner_id }
    : { ownerType: args.ownerType, ownerId: args.ownerId };

const agentIdentitySchema = z.object({
  userId: z.number().int().positive(),
  scopes: z.array(z.enum(['read', 'write'])),
  authSource: z.enum(['api_key', 'oauth_grant']),
  apiKeyId: z.number().int().optional(),
  oauthGrantId: z.number().int().optional(),
  rateLimitIdentity: z.number().int(),
});

/**
 * The credential `withMcpAuth` already verified for this request. Falls back
 * to resolving the Authorization header only when the transport did not
 * provide it (direct calls in tests).
 */
const resolveCallerIdentity = async (ctx: McpToolContext): Promise<AgentIdentity> => {
  const stamped = agentIdentitySchema.safeParse(
    ctx.http?.authInfo?.extra?.[MCP_AGENT_IDENTITY_KEY],
  );
  if (stamped.success) return stamped.data;
  const token = parseBearerToken(ctx.http?.req?.headers.get('authorization'));
  return resolveAgentIdentity(token);
};

/**
 * Per-credential rate limit (policy `mcp:tool`). Api key ids are positive;
 * OAuth grant ids are negated so identities never collide. Runs before any
 * allow-list or business query.
 */
const enforceToolRateLimit = async (
  ctx: McpToolContext,
  rateLimitIdentity: number,
): Promise<void> => {
  const request = ctx.http?.req;
  if (!request) return;
  const { limited, retryAfterSeconds } = await checkRateLimit(
    request,
    'mcp:tool',
    rateLimitIdentity,
  );
  if (!limited) return;
  throw new McpToolError(
    'RATE_LIMITED',
    'Límite de solicitudes alcanzado para esta conexión.',
    { hint: `Reintenta en ${retryAfterSeconds}s.` },
  );
};

const INTERNAL_ERROR: McpErrorPayload = {
  error: 'Error interno en la herramienta',
  code: 'INTERNAL',
};

/**
 * Only errors on the allow-list reach the model with their message. Anything
 * else (Prisma, driver, TypeError…) becomes a generic INTERNAL; the real
 * message stays in the `mcp.tool.failed` log.
 *
 * Plain `new Error(msg)` (exact class, not a subclass) is how services and
 * resolvers still report business rules ("Billetera no encontrada…"); those
 * pass as VALIDATION until MIC-I6-3 gives them typed errors.
 */
export const toErrorPayload = (error: unknown): McpErrorPayload => {
  if (error instanceof McpToolError) return error.toPayload();
  if (error instanceof AgentAuthError) {
    return { error: error.message, code: codeForStatus(error.status) };
  }
  if (error instanceof z.ZodError) {
    const details = error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { error: `Error de validación: ${details}`, code: 'VALIDATION' };
  }
  if (error instanceof CategoryServiceError || error instanceof IncomeServiceError) {
    return { error: error.message, code: codeForStatus(error.status) };
  }
  if (error instanceof AssigneeInvalidError) {
    return { error: error.message, code: 'VALIDATION' };
  }
  if (
    error instanceof Error &&
    Object.getPrototypeOf(error) === Error.prototype &&
    error.message
  ) {
    return { error: error.message, code: 'VALIDATION' };
  }
  return INTERNAL_ERROR;
};

const logToolFailure = (
  toolName: string,
  error: unknown,
  fields: Record<string, string | number | null>,
) => {
  logFinanceEvent('warn', 'mcp.tool.failed', {
    tool: toolName,
    ...fields,
    error_name: error instanceof Error ? error.name : typeof error,
    error: error instanceof Error ? error.message : String(error),
  });
};

/**
 * Runs an owner-scoped MCP tool: takes the credential the transport verified,
 * rate-limits it, enforces the scope, resolves the owner context (allow-list
 * + house membership), executes and serializes.
 */
export async function runAgentTool(
  toolName: string,
  ctx: McpToolContext,
  args: OwnerToolArgs,
  scope: AgentScope,
  fn: (agent: AgentContext) => Promise<unknown>,
): Promise<McpTextResult> {
  const { ownerType, ownerId } = readOwnerArgs(args);
  try {
    const identity = await resolveCallerIdentity(ctx);
    await enforceToolRateLimit(ctx, identity.rateLimitIdentity);
    assertScope(identity, scope);

    const agent = await resolveAgentContextForIdentity(identity, ownerType, ownerId);
    const data = await fn(agent);

    logFinanceEvent('info', 'mcp.tool.invoked', {
      tool: toolName,
      owner_type: agent.ownerType,
      owner_id: agent.ownerId,
      api_key_id: agent.apiKeyId ?? null,
      oauth_grant_id: agent.oauthGrantId ?? null,
      scope,
    });

    return jsonResult(data);
  } catch (error) {
    logToolFailure(toolName, error, { owner_type: ownerType, owner_id: ownerId });
    return errorPayloadResult(toErrorPayload(error));
  }
}

/**
 * Runs a tool that only needs the token user (no owner args), e.g.
 * `list_houses` — the discovery entry point.
 */
export async function runAgentUserTool(
  toolName: string,
  ctx: McpToolContext,
  fn: (user: {
    userId: number;
    scopes: AgentScope[];
    allowedContexts: AgentContextEntry[];
  }) => Promise<unknown>,
): Promise<McpTextResult> {
  try {
    const identity = await resolveCallerIdentity(ctx);
    await enforceToolRateLimit(ctx, identity.rateLimitIdentity);

    const allowedContexts = await loadAllowedContextsForIdentity(identity);
    const data = await fn({ ...identity, allowedContexts });

    logFinanceEvent('info', 'mcp.tool.invoked', {
      tool: toolName,
      user_id: identity.userId,
      api_key_id: identity.apiKeyId ?? null,
      oauth_grant_id: identity.oauthGrantId ?? null,
    });

    return jsonResult(data);
  } catch (error) {
    logToolFailure(toolName, error, {});
    return errorPayloadResult(toErrorPayload(error));
  }
}
