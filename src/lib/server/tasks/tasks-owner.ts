export const tasksOwnerWhere = (ownerType: 'user' | 'house', ownerId: number) =>
  ownerType === 'user'
    ? { user_id: ownerId, house_id: null as number | null }
    : { user_id: null as number | null, house_id: ownerId };
