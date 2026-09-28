/** Shown when the browser cannot reach the server (`Failed to fetch`, `Load failed`). */
export const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar. Revisa tu conexión e intenta de nuevo.';

const NETWORK_ERROR_PATTERNS = [
  /^failed to fetch$/i,
  /^load failed$/i,
  /^network request failed$/i,
  /networkerror/i,
  /failed to fetch resource/i,
];

/** True for the English message browsers throw when `fetch` never gets a response. */
export const isBrowserNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.trim();
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

/** Copy safe to render. Network failures become Spanish; other errors keep their message. */
export const userFacingErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (isBrowserNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};
