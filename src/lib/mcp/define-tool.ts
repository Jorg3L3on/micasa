import { z } from 'zod';
import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server';
import type { AgentContext, AgentScope } from '@/lib/server/resolve-agent-context';
import type { AgentContextEntry } from '@/schemas/agent-context.schema';
import {
  runAgentTool,
  runAgentUserTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { normalizeOwnerAliases, ownerArgs, type OwnerArgs } from '@/lib/mcp/schemas';

/**
 * `readOnlyHint` comes from `scope`, `openWorldHint` is always false (every
 * tool works on MiCasa's own data); tools only set the remaining hints.
 */
type ToolHints = Pick<ToolAnnotations, 'destructiveHint' | 'idempotentHint'>;

type OwnerShape = typeof ownerArgs;

type ToolInput<Shape extends z.ZodRawShape> = z.output<z.ZodObject<Shape>>;

const buildAnnotations = (scope: AgentScope, hints?: ToolHints): ToolAnnotations => ({
  ...hints,
  readOnlyHint: scope === 'read',
  openWorldHint: false,
});

/**
 * Registers an owner-scoped tool: adds `owner_type` / `owner_id` (camelCase
 * aliases accepted), rejects unknown keys, derives the annotations and runs
 * `run` through `runAgentTool` (auth, rate limit, scope, owner, error codes).
 */
export function defineOwnerTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  config: {
    name: string;
    title: string;
    description: string;
    scope: AgentScope;
    annotations?: ToolHints;
    input: Shape;
    run: (agent: AgentContext, args: ToolInput<Shape & OwnerShape>) => Promise<unknown>;
  },
) {
  const inputSchema = z.preprocess(
    normalizeOwnerAliases,
    z.object({ ...ownerArgs, ...config.input }).strict(),
  );

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema,
      annotations: buildAnnotations(config.scope, config.annotations),
    },
    async (args, ctx) => {
      const input = args as ToolInput<Shape & OwnerShape> & OwnerArgs;
      return runAgentTool(config.name, ctx as McpToolContext, input, config.scope, (agent) =>
        config.run(agent, input),
      );
    },
  );
}

/**
 * Registers a tool that acts on the token user only (no owner args), e.g.
 * `list_houses`. Read-only by construction.
 */
export function defineUserTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  config: {
    name: string;
    title: string;
    description: string;
    input: Shape;
    run: (
      user: { userId: number; scopes: AgentScope[]; allowedContexts: AgentContextEntry[] },
      args: ToolInput<Shape>,
    ) => Promise<unknown>;
  },
) {
  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: z.object(config.input).strict(),
      annotations: buildAnnotations('read'),
    },
    async (args, ctx) => {
      const input = args as ToolInput<Shape>;
      return runAgentUserTool(config.name, ctx as McpToolContext, (user) =>
        config.run(user, input),
      );
    },
  );
}
