export class AgentAuthError extends Error {
  readonly status: number;
  /** The credential's owner, when the token matched a key (for AGENT_AUTH_FAILED). */
  userId?: number;
  apiKeyId?: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgentAuthError';
    this.status = status;
  }

  /** Attaches the known credential so the auth trail can attribute the failure. */
  forCredential(credential: { userId: number; apiKeyId?: number }): this {
    this.userId = credential.userId;
    this.apiKeyId = credential.apiKeyId;
    return this;
  }
}
