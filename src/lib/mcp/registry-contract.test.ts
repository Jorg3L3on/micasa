import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract over the whole registry: annotations are coherent with what each
 * tool does, and the shared error paths (bad input, context outside the
 * connection's allow-list) answer with their code on every tool before any
 * service runs.
 */

const m = vi.hoisted(() => ({
  houseMemberFindFirst: vi.fn(),
  allowedContextsFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    houseMember: { findFirst: m.houseMemberFindFirst },
    agentConnectionAllowedContext: { findMany: m.allowedContextsFindMany },
  },
}));

import { registerMcpTools } from '@/lib/mcp/register-tools';
import { connectInMemoryMcp, type ListedTool } from '@/lib/mcp/testing/in-memory-client';
import { stampedAuthInfo } from '@/lib/mcp/behavior/harness';

/** Tools that delete data or overwrite balances: confirm + destructiveHint. */
const CONFIRM_TOOLS = ['adjust_balance', 'delete', 'regenerate_from_templates'];

let tools: ListedTool[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
  m.houseMemberFindFirst.mockResolvedValue({ role: 'OWNER' });
  // The connection may only act on house 42.
  m.allowedContextsFindMany.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 42 }]);
  const client = await connectInMemoryMcp(registerMcpTools);
  tools = await client.listTools();
  await client.close();
});

const call = async (name: string, args: Record<string, unknown>) => {
  const client = await connectInMemoryMcp(registerMcpTools, { authInfo: stampedAuthInfo });
  try {
    const result = await client.callTool(name, args);
    return { isError: result.isError, body: JSON.parse(result.content[0]!.text) };
  } finally {
    await client.close();
  }
};

const ownerTools = () => tools.filter((t) => t.name !== 'list_houses');

describe('annotations', () => {
  it('read tools are read-only and never destructive; write tools declare destructiveHint', () => {
    for (const tool of tools) {
      const a = tool.annotations ?? {};
      expect(a.openWorldHint, tool.name).toBe(false);
      if (a.readOnlyHint) {
        expect(a.destructiveHint, tool.name).toBeUndefined();
        expect(tool.name, tool.name).toMatch(/^(list|get)_/);
      } else {
        expect(typeof a.destructiveHint, `${tool.name} destructiveHint`).toBe('boolean');
        expect(tool.name).not.toMatch(/^(list|get)_/);
      }
    }
  });

  it('exactly the confirm tools are destructive and take a confirm argument', () => {
    const destructive = tools.filter((t) => t.annotations?.destructiveHint === true).map((t) => t.name);
    const withConfirm = tools.filter((t) => 'confirm' in (t.inputSchema.properties ?? {})).map((t) => t.name);

    expect(destructive.sort()).toEqual(CONFIRM_TOOLS);
    expect(withConfirm.sort()).toEqual(CONFIRM_TOOLS);
  });

  it('delete is not idempotent (a second delete of the same id fails)', () => {
    expect(tools.find((t) => t.name === 'delete')?.annotations?.idempotentHint).toBeUndefined();
  });

  it('every input object is strict and owner tools require owner_type / owner_id', () => {
    for (const tool of tools) {
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
    }
    for (const tool of ownerTools()) {
      expect(tool.inputSchema.required, tool.name).toEqual(
        expect.arrayContaining(['owner_type', 'owner_id']),
      );
    }
  });
});

describe('error codes across the registry', () => {
  it('an unknown argument answers VALIDATION on every tool, before any query', async () => {
    for (const tool of tools) {
      const base = tool.name === 'list_houses' ? {} : { owner_type: 'house', owner_id: 42 };
      const { isError, body } = await call(tool.name, { ...base, not_a_field: 1 });

      expect(isError, tool.name).toBe(true);
      expect(body.code, tool.name).toBe('VALIDATION');
      expect(body.error, tool.name).toContain('not_a_field');
    }
    expect(m.allowedContextsFindMany).not.toHaveBeenCalled();
  });

  it('a house outside the allow-list answers FORBIDDEN on every owner tool', async () => {
    for (const tool of ownerTools()) {
      const required = (tool.inputSchema.required ?? []).filter(
        (key) => key !== 'owner_type' && key !== 'owner_id',
      );
      const args = Object.fromEntries(
        required.map((key) => [key, sampleValue(tool, key)]),
      );
      const { isError, body } = await call(tool.name, {
        owner_type: 'house',
        owner_id: 7,
        ...args,
        ...(CONFIRM_TOOLS.includes(tool.name) ? { confirm: true } : {}),
      });

      expect(isError, tool.name).toBe(true);
      expect(body.code, `${tool.name}: ${body.error}`).toBe('FORBIDDEN');
    }
    expect(m.houseMemberFindFirst).not.toHaveBeenCalled();
  });
});

/** A valid value for a required argument, from its published JSON Schema. */
function sampleValue(tool: ListedTool, key: string): unknown {
  const prop = (tool.inputSchema.properties ?? {})[key] as {
    type?: string;
    enum?: unknown[];
    pattern?: string;
    minimum?: number;
  };
  if (prop.enum) return prop.enum[0];
  if (prop.pattern) return '2026-10-15';
  if (prop.type === 'integer' || prop.type === 'number') return Math.max(1, prop.minimum ?? 1) + 1;
  if (prop.type === 'boolean') return true;
  if (prop.type === 'array') return [];
  return 'x';
}
