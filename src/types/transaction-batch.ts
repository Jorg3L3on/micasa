export type BatchItemError = {
  code: string;
  message: string;
  /** Field the error belongs to, when known (maps to a table cell). */
  field?: string;
};

export type BatchItemResult =
  | { clientId: string; status: 'created'; id: number }
  | { clientId: string; status: 'failed'; error: BatchItemError };

export type BatchResponse = {
  results: BatchItemResult[];
  summary: { total: number; created: number; failed: number };
};
