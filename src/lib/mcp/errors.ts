/**
 * Machine-readable error codes returned by every MCP tool as
 * `{ error, code, hint?, candidates? }`.
 */
export type McpErrorCode =
  | 'NOT_FOUND'
  | 'AMBIGUOUS_REF'
  | 'CONFIRM_REQUIRED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export type McpErrorCandidate = { id: number; name: string };

export type McpErrorPayload = {
  error: string;
  code: McpErrorCode;
  hint?: string;
  candidates?: McpErrorCandidate[];
};

/**
 * Error a tool (or resolver) throws on purpose: its message reaches the model
 * as-is, together with the code and the optional hint / candidates.
 */
export class McpToolError extends Error {
  readonly code: McpErrorCode;
  readonly hint?: string;
  readonly candidates?: McpErrorCandidate[];

  constructor(
    code: McpErrorCode,
    message: string,
    options?: { hint?: string; candidates?: McpErrorCandidate[] },
  ) {
    super(message);
    this.name = 'McpToolError';
    this.code = code;
    this.hint = options?.hint;
    this.candidates = options?.candidates;
  }

  toPayload(): McpErrorPayload {
    return {
      error: this.message,
      code: this.code,
      ...(this.hint ? { hint: this.hint } : {}),
      ...(this.candidates?.length ? { candidates: this.candidates } : {}),
    };
  }
}

/** HTTP-style status carried by service / auth errors → MCP code. */
export const codeForStatus = (status: number): McpErrorCode => {
  if (status === 401 || status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL';
  return 'VALIDATION';
};
