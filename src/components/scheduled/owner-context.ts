import type { OwnerContext } from '@/lib/api-server';

export type OwnerSearchParams = {
  ownerType?: string;
  ownerId?: string;
};

/** `?ownerType=house&ownerId=1` → owner context for `fetchFromApi`. */
export const ownerContextFromSearchParams = (
  params: OwnerSearchParams,
): OwnerContext | undefined => {
  const id = Number(params.ownerId);
  if (
    (params.ownerType === 'user' || params.ownerType === 'house') &&
    Number.isInteger(id) &&
    id > 0
  ) {
    return { ownerType: params.ownerType, ownerId: id };
  }
  return undefined;
};

const LIST_PATH = {
  expense: '/settings/expense-templates',
  income: '/settings/income-templates',
} as const;

/**
 * The list a retired form route (`/new`, `/[id]/edit`) redirects to, keeping
 * a valid owner context so a bookmark opens the same house or user.
 */
export const scheduledListHref = (
  kind: keyof typeof LIST_PATH,
  params: OwnerSearchParams,
): string => {
  const owner = ownerContextFromSearchParams(params);
  if (!owner?.ownerType || !owner.ownerId) return LIST_PATH[kind];
  const query = new URLSearchParams({
    ownerType: owner.ownerType,
    ownerId: String(owner.ownerId),
  });
  return `${LIST_PATH[kind]}?${query.toString()}`;
};
