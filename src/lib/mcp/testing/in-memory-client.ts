import {
  InMemoryTransport,
  McpServer,
  type AuthInfo,
} from '@modelcontextprotocol/server';

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: { message: string };
};

export type ListedTool = {
  name: string;
  annotations?: Record<string, unknown>;
  inputSchema: {
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: unknown;
  };
};

export type ToolCallResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

/**
 * Minimal JSON-RPC client over the SDK's `InMemoryTransport`, for tests that
 * exercise tools through the real MCP request pipeline (validation,
 * `ctx.http.authInfo`) without HTTP.
 */
export async function connectInMemoryMcp(
  register: (server: McpServer) => void,
  options?: { authInfo?: AuthInfo },
) {
  const server = new McpServer(
    { name: 'micasa-test', version: '0.0.0' },
    { capabilities: { tools: {} } },
  );
  register(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const pending = new Map<number, (message: JsonRpcResponse) => void>();
  clientTransport.onmessage = (message) => {
    const response = message as JsonRpcResponse;
    if (response.id == null) return;
    pending.get(response.id)?.(response);
    pending.delete(response.id);
  };
  await clientTransport.start();

  let nextId = 0;
  const request = <T>(method: string, params: Record<string, unknown>): Promise<T> =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (response) =>
        response.error
          ? reject(new Error(response.error.message))
          : resolve(response.result as T),
      );
      void clientTransport.send(
        { jsonrpc: '2.0', id, method, params },
        { authInfo: options?.authInfo },
      );
    });

  await request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'micasa-test-client', version: '0.0.0' },
  });
  await clientTransport.send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  return {
    listTools: async () =>
      (await request<{ tools: ListedTool[] }>('tools/list', {})).tools,
    callTool: (name: string, args: Record<string, unknown>) =>
      request<ToolCallResult>('tools/call', { name, arguments: args }),
    close: () => clientTransport.close(),
  };
}
