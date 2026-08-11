import { z } from 'zod';

export const reportKindParamsSchema = z.object({
  kind: z.enum(['books', 'loans', 'overdue', 'fines', 'members'])
});

export const topBooksQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional()
});
