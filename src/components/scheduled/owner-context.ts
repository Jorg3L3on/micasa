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
