export class AgentAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgentAuthError';
    this.status = status;
  }
}
