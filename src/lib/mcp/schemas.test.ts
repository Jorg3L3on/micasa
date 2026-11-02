import { describe, expect, it } from 'vitest';
import { dateYmd, normalizeOwnerAliases } from '@/lib/mcp/schemas';

describe('dateYmd', () => {
  it.each(['2025-13-45', '2025-02-30', '2026-02-29', '2026-2-28', 'ayer'])(
    'rechaza %s',
    (value) => {
      expect(dateYmd.safeParse(value).success).toBe(false);
    },
  );

  it.each(['2026-02-28', '2028-02-29', '2026-12-31'])('acepta %s', (value) => {
    expect(dateYmd.parse(value)).toBe(value);
  });
});

describe('normalizeOwnerAliases', () => {
  it('renombra ownerType / ownerId a snake_case', () => {
    expect(normalizeOwnerAliases({ ownerType: 'house', ownerId: 3, name: 'x' })).toEqual({
      owner_type: 'house',
      owner_id: 3,
      name: 'x',
    });
  });

  it('prefiere la clave snake_case cuando llegan ambas', () => {
    expect(
      normalizeOwnerAliases({ owner_type: 'user', ownerType: 'house', owner_id: 1 }),
    ).toEqual({ owner_type: 'user', owner_id: 1 });
  });

  it('deja intactos los valores que no son objetos', () => {
    expect(normalizeOwnerAliases(undefined)).toBeUndefined();
    expect(normalizeOwnerAliases([1])).toEqual([1]);
  });
});
