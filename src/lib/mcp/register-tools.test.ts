import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));

import { registerMcpTools } from '@/lib/mcp/register-tools';
import { connectInMemoryMcp } from '@/lib/mcp/testing/in-memory-client';

/** Upper bound for the compact `tools/list` payload; raise it only on purpose. */
const TOOLS_LIST_BYTE_BUDGET = 66_000;

/**
 * Contract of the published surface: any change to a tool name, annotation,
 * required key or input property shows up here. Update the snapshot only for
 * intentional surface changes (and document them in docs/mcp-connector.md).
 */
describe('MCP tool registry', () => {
  it('tools/list coincide con el snapshot (nombres, anotaciones, required, properties)', async () => {
    const client = await connectInMemoryMcp(registerMcpTools);
    const tools = await client.listTools();
    await client.close();

    // v3 budget (MIC-I6-4, Plania decision on 66 000): 41 tools. v2 published 70 tools / 81 157 bytes.
    expect(tools).toHaveLength(41);
    expect(Buffer.byteLength(JSON.stringify({ tools }))).toBeLessThanOrEqual(TOOLS_LIST_BYTE_BUDGET);

    const surface = tools
      .map((tool) => ({
        name: tool.name,
        annotations: tool.annotations ?? {},
        required: [...(tool.inputSchema.required ?? [])].sort(),
        properties: Object.keys(tool.inputSchema.properties ?? {}).sort(),
        strict: tool.inputSchema.additionalProperties === false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    expect(surface).toMatchSnapshot();
  });
});
