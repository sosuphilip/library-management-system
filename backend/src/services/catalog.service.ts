import type { Book, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { buildPaginated, Paginated, prismaPagination } from '../utils/pagination';
import { audit } from './audit.service';
import { conflict, notFound } from '../utils/httpError';

// ---------------------------------------------------------------
// Search & listing
// ---------------------------------------------------------------

export interface BookListParams {
  q?: string;
  category?: string;
  availability?: 'available' | 'all';
  page: number;
  limit: number;
}

const bookInclude = {
  authors: { include: { author: true }, orderBy: { position: 'asc' as const } },
  categories: { include: { category: true } },
  copies: { orderBy: { createdAt: 'asc' as const }, take: 20 }
} satisfies Prisma.BookInclude;

function buildWhere(params: BookListParams): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = {};

  if (params.q) {
    const q = { contains: params.q, mode: 'insensitive' as Prisma.QueryMode };
    where.OR = [
      { title: q },
      { subtitle: q },
      { isbn: q },
      { publisher: q },
      { description: q },
      { authors: { some: { author: { name: q } } } }
    ];
  }

  if (params.category) {
    where.categories = {
      some: { category: { name: { equals: params.category, mode: 'insensitive' } } }
    };
  }

  if (params.availability === 'available') {
    where.copies = { some: { status: 'AVAILABLE' } };
  }

  return where;
}

export async function listBooks(params: BookListParams): Promise<Paginated<Book>> {
  const where = buildWhere(params);
  const { take, skip } = prismaPagination({ page: params.page, limit: params.limit });

  const [items, total] = await prisma.$transaction([
    prisma.book.findMany({
      where,
      include: bookInclude,
      orderBy: { title: 'asc' },
      take,
      skip
    }),
    prisma.book.count({ where })
  ]);

  return buildPaginated(items, total, { page: params.page, limit: params.limit });
}

export async function getBook(id: string): Promise<Book> {
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      ...bookInclude,
      copies: { orderBy: { createdAt: 'asc' } },
      loans: { include: { user: true }, take: 20, orderBy: { checkedOutAt: 'desc' } }
    }
  });
  if (!book) throw notFound('Book not found');
  return book;
}

// ---------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------

export interface BookUpsertInput {
  title?: string;
  subtitle?: string;
  isbn?: string;
  publisher?: string;
  year?: number;
  language?: string;
  description?: string;
  coverUrl?: string;
  pageCount?: number;
  authorNames?: string[];
  categoryNames?: string[];
  copies?: { barcode: string; condition: string }[];
}

/** Create or connect an author by name. Returns the author id. */
async function resolveAuthor(name: string): Promise<string> {
  const existing = await prisma.author.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.author.create({ data: { name } });
  return created.id;
}

async function resolveCategory(name: string): Promise<string> {
  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { name } });
  return created.id;
}

async function assertIsbnAvailable(isbn: string, excludeBookId?: string): Promise<void> {
  if (!isbn) return;
  const existing = await prisma.book.findUnique({ where: { isbn } });
  if (existing && existing.id !== excludeBookId) {
    throw conflict(`A book with ISBN ${isbn} already exists`);
  }
}

export async function createBook(input: BookUpsertInput): Promise<Book> {
  if (input.isbn) await assertIsbnAvailable(input.isbn);

  const authorNames = input.authorNames ?? [];
  const categoryNames = input.categoryNames ?? [];
  const authors = await Promise.all(authorNames.map((name) => resolveAuthor(name)));
  const categories = await Promise.all(categoryNames.map((name) => resolveCategory(name)));

  const book = await prisma.book.create({
    data: {
      title: input.title!,
      subtitle: input.subtitle,
      isbn: input.isbn || null,
      publisher: input.publisher,
      year: input.year,
      language: input.language,
      description: input.description,
      coverUrl: input.coverUrl,
      pageCount: input.pageCount,
      authors: {
        create: authors.map((authorId, index) => ({ authorId, position: index }))
      },
      categories: {
        create: categories.map((categoryId) => ({ categoryId }))
      },
      copies: input.copies?.length
        ? {
            create: input.copies.map((c) => ({ barcode: c.barcode, condition: c.condition as never }))
          }
        : undefined
    },
    include: bookInclude
  });

  await audit({
    action: 'BOOK.CREATE',
    entityType: 'BOOK',
    entityId: book.id,
    metadata: { title: input.title }
  });

  return book;
}

export async function updateBook(id: string, input: BookUpsertInput): Promise<Book> {
  await getBook(id);
  if (input.isbn) await assertIsbnAvailable(input.isbn, id);

  const authorNames = input.authorNames ?? [];
  const categoryNames = input.categoryNames ?? [];
  const authors = await Promise.all(authorNames.map((name) => resolveAuthor(name)));
  const categories = await Promise.all(categoryNames.map((name) => resolveCategory(name)));

  const book = await prisma.book.update({
    where: { id },
    data: {
      title: input.title,
      subtitle: input.subtitle,
      isbn: input.isbn === undefined ? undefined : input.isbn || null,
      publisher: input.publisher,
      year: input.year,
      language: input.language,
      description: input.description,
      coverUrl: input.coverUrl,
      pageCount: input.pageCount,
      ...(authorNames.length
        ? { authors: { deleteMany: {}, create: authors.map((authorId, i) => ({ authorId, position: i })) } }
        : {}),
      ...(categoryNames.length
        ? { categories: { deleteMany: {}, create: categories.map((categoryId) => ({ categoryId })) } }
        : {})
    },
    include: bookInclude
  });

  await audit({ action: 'BOOK.UPDATE', entityType: 'BOOK', entityId: id });

  return book;
}

export async function deleteBook(id: string): Promise<void> {
  const book = await prisma.book.findUnique({ where: { id }, include: { loans: { where: { status: 'ACTIVE' } } } });
  if (!book) throw notFound('Book not found');
  if (book.loans.length > 0) {
    throw conflict('Cannot delete a book that still has active loans');
  }
  await prisma.book.delete({ where: { id } });
  await audit({ action: 'BOOK.DELETE', entityType: 'BOOK', entityId: id });
}

// ---------------------------------------------------------------
// Copies
// ---------------------------------------------------------------

export async function addCopy(bookId: string, input: { barcode: string; condition: string }) {
  await getBook(bookId);

  const existing = await prisma.copy.findUnique({ where: { barcode: input.barcode } });
  if (existing) throw conflict(`A copy with barcode ${input.barcode} already exists`);

  const copy = await prisma.copy.create({
    data: { bookId, barcode: input.barcode, condition: input.condition as never }
  });

  await audit({ action: 'COPY.ADD', entityType: 'COPY', entityId: copy.id, metadata: { bookId } });
  return copy;
}

export async function updateCopy(copyId: string, input: Record<string, unknown>) {
  const copy = await prisma.copy.findUnique({ where: { id: copyId } });
  if (!copy) throw notFound('Copy not found');

  if (input.barcode) {
    const dup = await prisma.copy.findUnique({ where: { barcode: String(input.barcode) } });
    if (dup && dup.id !== copyId) throw conflict('That barcode is already in use');
  }

  const updated = await prisma.copy.update({ where: { id: copyId }, data: input });
  await audit({ action: 'COPY.UPDATE', entityType: 'COPY', entityId: copyId });
  return updated;
}

export async function deleteCopy(copyId: string): Promise<void> {
  const copy = await prisma.copy.findUnique({ where: { id: copyId }, include: { loans: { where: { status: 'ACTIVE' } } } });
  if (!copy) throw notFound('Copy not found');
  if (copy.loans.length > 0) {
    throw conflict('Cannot delete a copy that is currently checked out');
  }
  await prisma.copy.delete({ where: { id: copyId } });
  await audit({ action: 'COPY.DELETE', entityType: 'COPY', entityId: copyId });
}

// ---------------------------------------------------------------
// Authors
// ---------------------------------------------------------------

export async function listAuthors(params: { page: number; limit: number }) {
  const { take, skip } = prismaPagination(params);
  const [items, total] = await prisma.$transaction([
    prisma.author.findMany({
      orderBy: { name: 'asc' },
      take,
      skip,
      include: { _count: { select: { books: true } } }
    }),
    prisma.author.count()
  ]);
  return buildPaginated(items, total, params);
}

export async function createAuthor(input: { name: string; bio?: string }) {
  const existing = await prisma.author.findUnique({ where: { name: input.name } });
  if (existing) throw conflict('An author with that name already exists');
  const author = await prisma.author.create({ data: { name: input.name, bio: input.bio } });
  await audit({ action: 'AUTHOR.CREATE', entityType: 'AUTHOR', entityId: author.id });
  return author;
}

export async function updateAuthor(id: string, input: { name?: string; bio?: string }) {
  const existing = await prisma.author.findUnique({ where: { id } });
  if (!existing) throw notFound('Author not found');
  if (input.name) {
    const dup = await prisma.author.findUnique({ where: { name: input.name } });
    if (dup && dup.id !== id) throw conflict('An author with that name already exists');
  }
  const author = await prisma.author.update({ where: { id }, data: input });
  await audit({ action: 'AUTHOR.UPDATE', entityType: 'AUTHOR', entityId: id });
  return author;
}

export async function deleteAuthor(id: string): Promise<void> {
  const author = await prisma.author.findUnique({
    where: { id },
    include: { _count: { select: { books: true } } }
  });
  if (!author) throw notFound('Author not found');
  if (author._count.books > 0) {
    throw conflict('Cannot delete an author who has books; remove the book links first');
  }
  await prisma.author.delete({ where: { id } });
  await audit({ action: 'AUTHOR.DELETE', entityType: 'AUTHOR', entityId: id });
}

// ---------------------------------------------------------------
// Categories
// ---------------------------------------------------------------

export async function listCategories(params: { page: number; limit: number }) {
  const { take, skip } = prismaPagination(params);
  const [items, total] = await prisma.$transaction([
    prisma.category.findMany({ orderBy: { name: 'asc' }, take, skip, include: { _count: { select: { books: true } } } }),
    prisma.category.count()
  ]);
  return buildPaginated(items, total, params);
}

export async function createCategory(input: { name: string; description?: string; loanPeriodDays?: number }) {
  const existing = await prisma.category.findUnique({ where: { name: input.name } });
  if (existing) throw conflict('A category with that name already exists');
  const category = await prisma.category.create({ data: input });
  await audit({ action: 'CATEGORY.CREATE', entityType: 'CATEGORY', entityId: category.id });
  return category;
}

export async function updateCategory(id: string, input: Record<string, unknown>) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound('Category not found');
  if (input.name) {
    const dup = await prisma.category.findUnique({ where: { name: String(input.name) } });
    if (dup && dup.id !== id) throw conflict('A category with that name already exists');
  }
  const category = await prisma.category.update({ where: { id }, data: input });
  await audit({ action: 'CATEGORY.UPDATE', entityType: 'CATEGORY', entityId: id });
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { books: true } } }
  });
  if (!category) throw notFound('Category not found');
  if (category._count.books > 0) {
    throw conflict('Cannot delete a category that has books; remove the book links first');
  }
  await prisma.category.delete({ where: { id } });
  await audit({ action: 'CATEGORY.DELETE', entityType: 'CATEGORY', entityId: id });
}

// ---------------------------------------------------------------
// Open Library ISBN lookup
// ---------------------------------------------------------------

const OPEN_LIBRARY_URL = 'https://openlibrary.org/isbn';

export interface IsbnLookupResult {
  isbn: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  year?: number;
  description?: string;
  coverUrl?: string;
  pageCount?: number;
}

export async function lookupIsbn(isbn: string): Promise<IsbnLookupResult> {
  const normalized = isbn.replace(/-/g, '');
  const res = await fetch(`${OPEN_LIBRARY_URL}/${encodeURIComponent(normalized)}.json`);
  if (!res.ok) {
    throw notFound(`ISBN ${isbn} not found in Open Library`);
  }
  const data = (await res.json()) as Record<string, unknown>;

  const authors = Array.isArray(data.authors)
    ? data.authors
        .map((a: unknown) => (a && typeof a === 'object' && 'name' in a ? (a as { name: unknown }).name : undefined))
        .filter((n): n is string => typeof n === 'string')
    : [];

  const publishDate = typeof data.publish_date === 'string' ? data.publish_date : undefined;
  const year = publishDate ? Number(publishDate.match(/\d{4}/)?.[0]) : undefined;

  const covers = data.covers;
  const coverId = Array.isArray(covers) && covers.length ? Number(covers[0]) : undefined;
  const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;

  return {
    isbn,
    title: String(data.title ?? 'Unknown title'),
    subtitle: typeof data.subtitle === 'string' ? data.subtitle : undefined,
    authors: authors.length ? authors : undefined,
    publisher:
      Array.isArray(data.publishers) && typeof data.publishers[0] === 'string'
        ? data.publishers[0]
        : undefined,
    year: Number.isFinite(year) ? year : undefined,
    description:
      typeof data.description === 'string'
        ? data.description
        : data.description && typeof data.description === 'object'
          ? String((data.description as { value?: unknown }).value ?? '')
          : undefined,
    coverUrl,
    pageCount: typeof data.number_of_pages === 'number' ? data.number_of_pages : undefined
  };
}
