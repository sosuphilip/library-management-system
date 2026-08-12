import { z } from 'zod';

export const auditQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(50).optional()
});

const NOTIFICATION_TYPES = [
  'DUE_SOON',
  'OVERDUE',
  'HOLD_AVAILABLE',
  'HOLD_EXPIRED',
  'PASSWORD_RESET',
  'FINE_CHARGED'
] as const;

export const templateParamsSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES)
});

export const templateSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  body: z.string().trim().min(1, 'Body is required').max(5000)
});
