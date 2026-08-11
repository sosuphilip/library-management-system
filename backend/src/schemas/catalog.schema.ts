import { z } from 'zod';

// ---------------------------------------------------------------
// Books
// ---------------------------------------------------------------

const isbnSchema = z
  .string()
  .trim()
  .refine((s) => /^[\d-]{10,17}$/.test(s.replace(/-/g, '')), {
    message: 'ISBN must be 10 or 13 digits (dashes optional)'
  });

const copyInputSchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required').max(64),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']).default('GOOD'),
  status: z.enum(['AVAILABLE', 'CHECKED_OUT', 'LOST', 'DAMAGED', 'IN_REPAIR']).optional()
});

export const createBookSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  subtitle: z.string().trim().max(500).optional(),
  isbn: isbnSchema.optional().or(z.literal('').transform(() => undefined)),
  publisher: z.string().trim().max(200).optional(),
  year: z.coerce.number().int().min(1000).max(2100).optional(),
  language: z.string().trim().max(50).optional(),
  description: z.string().trim().max(5000).optional(),
  coverUrl: z.string().url().optional(),
  pageCount: z.coerce.number().int().positive().optional(),
  authorNames: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  categoryNames: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  copies: z.array(copyInputSchema).max(50).optional()
});

export const updateBookSchema = createBookSchema.partial();

export const bookParamsSchema = z.object({
  id: z.string().uuid()
});

// ---------------------------------------------------------------
// Authors
// ---------------------------------------------------------------

export const createAuthorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  bio: z.string().trim().max(2000).optional()
});

export const updateAuthorSchema = createAuthorSchema.partial();

// ---------------------------------------------------------------
// Categories
// ---------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(1000).optional(),
  loanPeriodDays: z.coerce.number().int().positive().max(365).optional()
});

export const updateCategorySchema = createCategorySchema.partial();

// ---------------------------------------------------------------
// Copies
// ---------------------------------------------------------------

export const createCopySchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required').max(64),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']).default('GOOD')
});

export const updateCopySchema = z.object({
  barcode: z.string().trim().min(1).max(64).optional(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
  status: z.enum(['AVAILABLE', 'CHECKED_OUT', 'LOST', 'DAMAGED', 'IN_REPAIR']).optional(),
  notes: z.string().trim().max(1000).nullable().optional()
});

export const copyParamsSchema = z.object({
  id: z.string().uuid()
});

// ---------------------------------------------------------------
// Search / list query
// ---------------------------------------------------------------

export const listBooksQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  availability: z.enum(['available', 'all']).default('all'),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export const isbnLookupParamsSchema = z.object({
  isbn: z.string().trim().min(1)
});
