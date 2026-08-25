/** UI/server-shared shape for a context the user may grant to an MCP connection. */
export type SelectableContext = {
  ownerType: 'user' | 'house';
  ownerId: number;
  label: string;
  helper?: string;
};
