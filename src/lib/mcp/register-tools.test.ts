import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));

import { registerMcpTools } from '@/lib/mcp/register-tools';
import { connectInMemoryMcp } from '@/lib/mcp/testing/in-memory-client';

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
