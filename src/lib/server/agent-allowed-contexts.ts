import { AgentContextOwnerType } from '@/generated/prisma/client';
import { listUserHouses } from '@/lib/house/house.service';
import { AgentAuthError } from '@/lib/server/agent-auth-error';
import type { SelectableContext } from '@/components/settings/AgentContextPicker';
import type { AgentContextEntry } from '@/schemas/agent-context.schema';
import prisma from '@/lib/prisma';

const forbidden = (message: string) => new AgentAuthError(message, 403);

export const toPrismaOwnerType = (
  ownerType: 'user' | 'house',
): AgentContextOwnerType =>
  ownerType === 'user' ? AgentContextOwnerType.USER : AgentContextOwnerType.HOUSE;

export const fromPrismaOwnerType = (
  ownerType: AgentContextOwnerType,
): 'user' | 'house' => (ownerType === AgentContextOwnerType.USER ? 'user' : 'house');

export const contextKey = (entry: AgentContextEntry): string =>
  `${entry.ownerType}:${entry.ownerId}`;

export const dedupeContexts = (entries: AgentContextEntry[]): AgentContextEntry[] => {
  const seen = new Set<string>();
  const result: AgentContextEntry[] = [];
  for (const entry of entries) {
    const key = contextKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
};

export const buildSelectableContextsForUser = async (
  userId: number,
): Promise<SelectableContext[]> => {
  const houses = await listUserHouses(userId);
  return [
    {
      ownerType: 'user',
      ownerId: userId,
      label: 'Cuenta personal',
      helper: 'Finanzas privadas del usuario.',
    },
    ...houses.map((house) => ({
      ownerType: 'house' as const,
      ownerId: house.id,
      label: house.name,
      helper: `Rol: ${house.role.toLowerCase()}`,
    })),
  ];
};

export const loadAllowedContextsForApiKey = async (
  apiKeyId: number,
): Promise<AgentContextEntry[]> => {
  const rows = await prisma.agentConnectionAllowedContext.findMany({
    where: { api_key_id: apiKeyId },
    select: { owner_type: true, owner_id: true },
  });
  return rows.map((row) => ({
    ownerType: fromPrismaOwnerType(row.owner_type),
    ownerId: row.owner_id,
  }));
};

export const loadAllowedContextsForOAuthGrant = async (
  oauthGrantId: number,
): Promise<AgentContextEntry[]> => {
  const rows = await prisma.agentConnectionAllowedContext.findMany({
    where: { oauth_grant_id: oauthGrantId },
    select: { owner_type: true, owner_id: true },
  });
  return rows.map((row) => ({
    ownerType: fromPrismaOwnerType(row.owner_type),
    ownerId: row.owner_id,
  }));
};

/**
 * Validates that the user may select these contexts (personal = self, houses =
 * current membership). Does not persist.
 */
export const validateSelectableContexts = async (
  userId: number,
  contexts: AgentContextEntry[],
  options?: { allowEmpty?: boolean },
): Promise<AgentContextEntry[]> => {
  const unique = dedupeContexts(contexts);
  if (unique.length === 0) {
    if (options?.allowEmpty) return [];
    throw new AgentAuthError('Selecciona al menos un contexto', 400);
  }

  for (const entry of unique) {
    if (entry.ownerType === 'user') {
      if (entry.ownerId !== userId) {
        throw forbidden('Solo puedes autorizar tu cuenta personal');
      }
      continue;
    }

    const membership = await prisma.houseMember.findFirst({
      where: { user_id: userId, house_id: entry.ownerId },
      select: { house_id: true },
    });
    if (!membership) {
      throw forbidden('No eres miembro de una casa seleccionada');
    }
  }

  return unique;
};

export const assertOwnerOnAllowList = (
  allowedContexts: AgentContextEntry[],
  ownerType: 'user' | 'house',
  ownerId: number,
): void => {
  if (allowedContexts.length === 0) {
    throw forbidden(
      'Esta conexión no tiene contextos autorizados. Edítala en Ajustes → Conexiones.',
    );
  }

  const allowed = allowedContexts.some(
    (entry) => entry.ownerType === ownerType && entry.ownerId === ownerId,
  );
  if (!allowed) {
    throw forbidden('Contexto no autorizado para esta conexión');
  }
};

export const filterAllowedHouses = <T extends { id: number }>(
  houses: T[],
  allowedContexts: AgentContextEntry[],
): T[] => {
  const allowedHouseIds = new Set(
    allowedContexts
      .filter((entry) => entry.ownerType === 'house')
      .map((entry) => entry.ownerId),
  );
  return houses.filter((house) => allowedHouseIds.has(house.id));
};

export const isPersonalContextAllowed = (
  userId: number,
  allowedContexts: AgentContextEntry[],
): boolean =>
  allowedContexts.some(
    (entry) => entry.ownerType === 'user' && entry.ownerId === userId,
  );

export const replaceApiKeyAllowedContexts = async (
  apiKeyId: number,
  contexts: AgentContextEntry[],
): Promise<void> => {
  const unique = dedupeContexts(contexts);
  await prisma.$transaction([
    prisma.agentConnectionAllowedContext.deleteMany({
      where: { api_key_id: apiKeyId },
    }),
    ...(unique.length > 0
      ? [
          prisma.agentConnectionAllowedContext.createMany({
            data: unique.map((entry) => ({
              api_key_id: apiKeyId,
              oauth_grant_id: null,
              owner_type: toPrismaOwnerType(entry.ownerType),
              owner_id: entry.ownerId,
            })),
          }),
        ]
      : []),
  ]);
};

export const replaceOAuthGrantAllowedContexts = async (
  oauthGrantId: number,
  contexts: AgentContextEntry[],
): Promise<void> => {
  const unique = dedupeContexts(contexts);
  await prisma.$transaction([
    prisma.agentConnectionAllowedContext.deleteMany({
      where: { oauth_grant_id: oauthGrantId },
    }),
    ...(unique.length > 0
      ? [
          prisma.agentConnectionAllowedContext.createMany({
            data: unique.map((entry) => ({
              api_key_id: null,
              oauth_grant_id: oauthGrantId,
              owner_type: toPrismaOwnerType(entry.ownerType),
              owner_id: entry.ownerId,
            })),
          }),
        ]
      : []),
  ]);
};

export const createAuthorizationCodeContexts = async (
  authorizationCodeId: number,
  contexts: AgentContextEntry[],
): Promise<void> => {
  const unique = dedupeContexts(contexts);
  if (unique.length === 0) return;
  await prisma.mcpOAuthAuthorizationCodeContext.createMany({
    data: unique.map((entry) => ({
      authorization_code_id: authorizationCodeId,
      owner_type: toPrismaOwnerType(entry.ownerType),
      owner_id: entry.ownerId,
    })),
  });
};

export const loadAuthorizationCodeContexts = async (
  authorizationCodeId: number,
): Promise<AgentContextEntry[]> => {
  const rows = await prisma.mcpOAuthAuthorizationCodeContext.findMany({
    where: { authorization_code_id: authorizationCodeId },
    select: { owner_type: true, owner_id: true },
  });
  return rows.map((row) => ({
    ownerType: fromPrismaOwnerType(row.owner_type),
    ownerId: row.owner_id,
  }));
};

const REPEATED_CONSENT_FORM_KEYS = new Set([
  'context_owner_type',
  'context_owner_id',
]);

export const appendConsentFormValue = (
  fields: Record<string, string | string[]>,
  key: string,
  value: string,
): void => {
  if (REPEATED_CONSENT_FORM_KEYS.has(key)) {
    const existing = fields[key];
    if (existing === undefined) {
      fields[key] = value;
      return;
    }
    if (Array.isArray(existing)) {
      existing.push(value);
      return;
    }
    fields[key] = [existing, value];
    return;
  }
  fields[key] = value;
};

/** Preserves repeated keys (e.g. multiple context checkboxes) unlike Object.fromEntries. */
export const parseConsentFormData = (
  form: FormData,
): Record<string, string | string[]> => {
  const fields: Record<string, string | string[]> = {};
  for (const [key, value] of form.entries()) {
    appendConsentFormValue(fields, key, String(value));
  }
  return fields;
};

export const scalarConsentField = (
  fields: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const value = fields[key];
  if (Array.isArray(value)) return value[0];
  return value;
};

export const parseContextFieldsFromForm = (
  fields: Record<string, string | string[] | undefined>,
): AgentContextEntry[] => {
  const rawTypes = fields.context_owner_type;
  const rawIds = fields.context_owner_id;

  const types = Array.isArray(rawTypes)
    ? rawTypes
    : rawTypes != null
      ? [rawTypes]
      : [];
  const ids = Array.isArray(rawIds) ? rawIds : rawIds != null ? [rawIds] : [];

  if (types.length === 0 && typeof fields.allowed_contexts === 'string') {
    try {
      const parsed = JSON.parse(fields.allowed_contexts) as unknown;
      if (Array.isArray(parsed)) {
        return dedupeContexts(
          parsed
            .filter(
              (item): item is AgentContextEntry =>
                item != null &&
                typeof item === 'object' &&
                (item as AgentContextEntry).ownerType != null &&
                typeof (item as AgentContextEntry).ownerId === 'number',
            )
            .map((item) => ({
              ownerType: item.ownerType,
              ownerId: item.ownerId,
            })),
        );
      }
    } catch {
      return [];
    }
  }

  const entries: AgentContextEntry[] = [];
  for (let index = 0; index < Math.min(types.length, ids.length); index += 1) {
    const ownerType = types[index];
    const ownerId = Number(ids[index]);
    if (ownerType !== 'user' && ownerType !== 'house') continue;
    if (!Number.isInteger(ownerId) || ownerId <= 0) continue;
    entries.push({ ownerType, ownerId });
  }
  return dedupeContexts(entries);
};
