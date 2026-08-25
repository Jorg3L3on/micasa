import { z } from 'zod';

export const agentContextOwnerTypeSchema = z.enum(['user', 'house']);

export const agentContextEntrySchema = z.object({
  ownerType: agentContextOwnerTypeSchema,
  ownerId: z.number().int().positive(),
});

export const agentContextListSchema = z
  .array(agentContextEntrySchema)
  .min(1, 'Selecciona al menos un contexto');

/** Editable allow-list (may be empty → fail closed for that connection). */
export const agentContextListUpdateSchema = z.array(agentContextEntrySchema);

export type AgentContextEntry = z.infer<typeof agentContextEntrySchema>;

export type AgentContextDto = AgentContextEntry & {
  label?: string;
};
