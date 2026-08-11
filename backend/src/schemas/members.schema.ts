import { z } from 'zod';

export const memberParamsSchema = z.object({
  id: z.string().uuid()
});

export const listMembersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export const updateMemberSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional()
});

export const suspendMemberSchema = z.object({
  days: z.coerce.number().int().positive().max(365).optional()
});

export const fineAdjustSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().min(1, 'A reason is required').max(500)
});

export const listFinesQuerySchema = z.object({
  status: z.enum(['UNPAID', 'PAID', 'WAIVED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});
