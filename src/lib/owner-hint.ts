import type { FinanceContextType } from '@/types/finance-context';

/**
 * Last owner context picked on this device, as a cookie the proxy can read
 * before any HTML streams. A hint only: every page and API request still
 * validates the owner (house membership) through `getOwnerContext`.
 */
export const OWNER_HINT_COOKIE = 'micasa_owner';

const OWNER_HINT_MAX_AGE_S = 60 * 60 * 24 * 365;

/** `<userId>:<user|house>:<ownerId>`; the user id keeps a shared device from mixing accounts. */
export const serializeOwnerHint = (
  userId: number,
  context: FinanceContextType,
): string => `${userId}:${context.type}:${context.id}`;

export const parseOwnerHint = (
  value: string | null | undefined,
  userId: number,
): FinanceContextType | null => {
  if (!value) return null;
  const match = /^(\d+):(user|house):(\d+)$/.exec(value);
  if (!match) return null;
  if (Number(match[1]) !== userId) return null;
  const id = Number(match[3]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (match[2] === 'house') return { type: 'house', id };
  return id === userId ? { type: 'user', id } : null;
};

export const writeOwnerHintCookie = (
  userId: number,
  context: FinanceContextType,
): void => {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${OWNER_HINT_COOKIE}=${serializeOwnerHint(userId, context)}; Path=/; Max-Age=${OWNER_HINT_MAX_AGE_S}; SameSite=Lax${secure}`;
};

/** Owner query for a post-login redirect: the hint when it belongs to this user, else the user. */
export const ownerQueryFromHint = (
  hintValue: string | null | undefined,
  userId: number,
): URLSearchParams => {
  const owner = parseOwnerHint(hintValue, userId) ?? { type: 'user', id: userId };
  return new URLSearchParams({ ownerType: owner.type, ownerId: String(owner.id) });
};
