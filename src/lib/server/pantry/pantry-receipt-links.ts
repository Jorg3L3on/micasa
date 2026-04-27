const LINKED_CART_PREFIX = '__LINKED_CART_ID__:';

export const stripReceiptSystemWarnings = (warnings: string[]): string[] =>
  warnings.filter((warning) => !warning.startsWith(LINKED_CART_PREFIX));

export const extractLinkedCartIdFromWarnings = (
  warnings: string[],
): number | null => {
  const marker = warnings.find((warning) =>
    warning.startsWith(LINKED_CART_PREFIX),
  );
  if (!marker) return null;
  const parsed = Number.parseInt(marker.slice(LINKED_CART_PREFIX.length), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const withLinkedCartWarning = (
  warnings: string[],
  linkedCartId: number | null,
): string[] => {
  const cleaned = stripReceiptSystemWarnings(warnings);
  if (!linkedCartId) return cleaned;
  return [...cleaned, `${LINKED_CART_PREFIX}${linkedCartId}`];
};
