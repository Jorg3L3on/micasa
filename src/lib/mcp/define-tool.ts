import { z } from 'zod';
import type {
  McpServer,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from '@modelcontextprotocol/server';
import type { AgentContext, AgentScope } from '@/lib/server/resolve-agent-context';
import type { AgentContextEntry } from '@/schemas/agent-context.schema';
import {
  errorResultFor,
  runAgentTool,
  runAgentUserTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { McpToolError } from '@/lib/mcp/errors';
import { normalizeOwnerAliases, ownerArgs, type OwnerArgs } from '@/lib/mcp/schemas';

/**
 * `readOnlyHint` comes from `scope`, `openWorldHint` is always false (every
 * tool works on MiCasa's own data); tools only set the remaining hints.
 */
type ToolHints = Pick<ToolAnnotations, 'destructiveHint' | 'idempotentHint'>;

type OwnerShape = typeof ownerArgs;

type ToolInput<Shape extends z.ZodRawShape> = z.output<z.ZodObject<Shape>>;

/** Hints equal to the spec default (readOnly/idempotent false) are left out. */
const buildAnnotations = (scope: AgentScope, hints?: ToolHints): ToolAnnotations => ({
  ...(hints?.destructiveHint !== undefined ? { destructiveHint: hints.destructiveHint } : {}),
  ...(hints?.idempotentHint ? { idempotentHint: true } : {}),
  ...(scope === 'read' ? { readOnlyHint: true } : {}),
  openWorldHint: false,
});

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

const isEmptyObject = (value: unknown): boolean =>
  value != null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;

/**
 * Drops JSON Schema noise zod emits on every tool: the root `$schema` URL, the
 * ±2^53 bounds of `z.number().int()` and empty `additionalProperties`. All are
 * implied for MCP clients and cost several KB of `tools/list`.
 */
const stripJsonSchemaNoise = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(stripJsonSchemaNoise);
  if (node == null || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema') continue;
    if (key === 'maximum' && value === MAX_SAFE) continue;
    // `{}` (any extra key) is what an absent additionalProperties already means.
    if (key === 'additionalProperties' && isEmptyObject(value)) continue;
    if (key === 'minimum' && value === -MAX_SAFE) continue;
    out[key] = stripJsonSchemaNoise(value);
  }
  return out;
};

/**
 * What the SDK sees: the compact JSON Schema for `tools/list` and a validator
 * that accepts anything. The tool validates with zod itself so a bad input
 * comes back in the same `{ error, code }` shape as every other error, and an
 * output schema documents the response without failing a call in production
 * (tests validate real responses against it; see `toolOutputSchemas`).
 */
const publishedSchema = <Input, Output>(
  schema: StandardSchemaWithJSON<Input, Output>,
): StandardSchemaWithJSON<Input, Output> => {
  const std = schema['~standard'];
  return {
    '~standard': {
      ...std,
      validate: (value: unknown) => ({ value: value as Output }),
      jsonSchema: {
        input: (options) =>
          stripJsonSchemaNoise(std.jsonSchema.input(options)) as Record<string, unknown>,
        output: (options) =>
          stripJsonSchemaNoise(std.jsonSchema.output(options)) as Record<string, unknown>,
      },
    },
  };
};

/** Output schemas by tool name, for the registry test that validates responses. */
export const toolOutputSchemas = new Map<string, z.ZodType>();

const confirmField = z
  .boolean()
  .optional()
  .describe('Debe ser true: confirma que el usuario aprobó esta operación, que elimina datos o sobreescribe saldos.');

type ToolOutput = z.ZodRawShape | undefined;

const registerOutput = (name: string, output: ToolOutput) => {
  if (!output) return undefined;
  // Responses may carry more keys than the schema lists (sections, extras).
  const schema = z.looseObject(output);
  toolOutputSchemas.set(name, schema);
  return publishedSchema(schema);
};

/**
 * Registers an owner-scoped tool: adds `owner_type` / `owner_id` (camelCase
 * aliases accepted), rejects unknown keys, derives the annotations and runs
 * `run` through `runAgentTool` (auth, rate limit, scope, owner, error codes).
 * `confirm: true` adds the `confirm` argument and answers CONFIRM_REQUIRED
 * until the caller sends `confirm: true`. `output` declares the response
 * (`outputSchema` + `structuredContent`).
 */
export function defineOwnerTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  config: {
    name: string;
    title: string;
    description: string;
    scope: AgentScope;
    annotations?: ToolHints;
    confirm?: boolean;
    input: Shape;
    output?: ToolOutput;
    run: (agent: AgentContext, args: ToolInput<Shape & OwnerShape>) => Promise<unknown>;
  },
) {
  const shape = {
    ...ownerArgs,
    ...config.input,
    ...(config.confirm ? { confirm: confirmField } : {}),
  };
  const schema = z.preprocess(normalizeOwnerAliases, z.object(shape).strict());

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: publishedSchema(schema),
      outputSchema: registerOutput(config.name, config.output),
      annotations: buildAnnotations(config.scope, config.annotations),
    },
    async (args, ctx) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success) return errorResultFor(parsed.error);
      const input = parsed.data as ToolInput<Shape & OwnerShape> & OwnerArgs & { confirm?: boolean };
      return runAgentTool(
        config.name,
        ctx as McpToolContext,
        input,
        config.scope,
        async (agent) => {
          if (config.confirm && input.confirm !== true) {
            throw new McpToolError('CONFIRM_REQUIRED', 'Esta operación requiere confirm: true.', {
              hint: 'Confirma con el usuario y repite la llamada con confirm: true.',
            });
          }
          return config.run(agent, input);
        },
        { structured: config.output != null },
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
    output?: ToolOutput;
    run: (
      user: { userId: number; scopes: AgentScope[]; allowedContexts: AgentContextEntry[] },
      args: ToolInput<Shape>,
    ) => Promise<unknown>;
  },
) {
  const schema = z.object(config.input).strict();

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: publishedSchema(schema),
      outputSchema: registerOutput(config.name, config.output),
      annotations: buildAnnotations('read'),
    },
    async (args, ctx) => {
      const parsed = schema.safeParse(args ?? {});
      if (!parsed.success) return errorResultFor(parsed.error);
      const input = parsed.data as ToolInput<Shape>;
      return runAgentUserTool(
        config.name,
        ctx as McpToolContext,
        (user) => config.run(user, input),
        { structured: config.output != null },
      );
    },
  );
}
