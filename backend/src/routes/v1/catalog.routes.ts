import { Router } from 'express';
import * as catalogController from '../../controllers/catalog.controller';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  bookParamsSchema,
  copyParamsSchema,
  createAuthorSchema,
  createBookSchema,
  createCategorySchema,
  createCopySchema,
  isbnLookupParamsSchema,
  listBooksQuerySchema,
  updateAuthorSchema,
  updateBookSchema,
  updateCategorySchema,
  updateCopySchema
} from '../../schemas/catalog.schema';

const router = Router();
const staff = requireRole('LIBRARIAN', 'ADMIN');

// Browse is open to any authenticated user; staff mutations need LIBRARIAN+
// NOTE: specific paths (/authors, /categories, /isbn, /copies) MUST be
// registered before the catch-all /:id or Express will match them as book ids.

// ---- Authors ----
router.get('/authors', requireAuth, catalogController.listAuthors);
router.post(
  '/authors',
  requireAuth,
  staff,
  validate({ body: createAuthorSchema }),
  catalogController.createAuthor
);
router.patch(
  '/authors/:id',
  requireAuth,
  staff,
  validate({ params: bookParamsSchema, body: updateAuthorSchema }),
  catalogController.updateAuthor
);
router.delete(
  '/authors/:id',
  requireAuth,
  staff,
  validate({ params: bookParamsSchema }),
  catalogController.deleteAuthor
);

// ---- Categories ----
router.get('/categories', requireAuth, catalogController.listCategories);
router.post(
  '/categories',
  requireAuth,
  staff,
  validate({ body: createCategorySchema }),
  catalogController.createCategory
);
router.patch(
  '/categories/:id',
  requireAuth,
  staff,
  validate({ params: bookParamsSchema, body: updateCategorySchema }),
  catalogController.updateCategory
);
router.delete(
  '/categories/:id',
  requireAuth,
  staff,
  validate({ params: bookParamsSchema }),
  catalogController.deleteCategory
);

// ---- Copies (standalone, by copy id) ----
router.patch(
  '/copies/:id',
  requireAuth,
  staff,
  validate({ params: copyParamsSchema, body: updateCopySchema }),
  catalogController.updateCopy
);
router.delete(
  '/copies/:id',
  requireAuth,
  staff,
  validate({ params: copyParamsSchema }),
  catalogController.deleteCopy
);

// ---- Books ----
router.get('/', requireAuth, validate({ query: listBooksQuerySchema }), catalogController.listBooks);
router.get(
  '/isbn/:isbn',
  requireAuth,
  validate({ params: isbnLookupParamsSchema }),
  catalogController.lookupIsbn
);
router.get('/:id', requireAuth, validate({ params: bookParamsSchema }), catalogController.getBook);
router.post(
  '/',
  requireAuth,
  staff,
  validate({ body: createBookSchema }),
  catalogController.createBook
);
router.patch(
  '/:id',
  requireAuth,
  staff,
  validate({ params: bookParamsSchema, body: updateBookSchema }),
  catalogController.updateBook
);
router.delete(
  '/:id',
  requireAuth,
  staff,
  validate({ params: bookParamsSchema }),
  catalogController.deleteBook
);

// ---- Copies (nested under a book) ----
router.post(
  '/:id/copies',
  requireAuth,
  staff,
  validate({ params: bookParamsSchema, body: createCopySchema }),
  catalogController.addCopy
);

export default router;
