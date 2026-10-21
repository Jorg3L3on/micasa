import { z } from 'zod';

export const cardIdSchema = z
  .number()
  .int()
  .positive()
  .describe('Tarjeta, de list_wallets (type credit).');
