import { z } from 'zod';

export const checkoutSchema = z.object({
  copyId: z.string().uuid(),
  userId: z.string().uuid()
});

export const returnBookSchema = z.object({
  copyId: z.string().uuid()
});

export const renewLoanSchema = z.object({
  loanId: z.string().uuid()
});

export const reserveBookSchema = z.object({
  bookId: z.string().uuid()
});

export const reservationParamsSchema = z.object({
  id: z.string().uuid()
});

export const loanParamsSchema = z.object({
  id: z.string().uuid()
});

export const payFineSchema = z.object({
  fineId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'CARD', 'ONLINE']).default('CASH')
});

export const waiveFineSchema = z.object({
  fineId: z.string().uuid(),
  reason: z.string().trim().min(1, 'A reason is required to waive a fine').max(500)
});

export const listLoansQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'RETURNED', 'LOST']).optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});
