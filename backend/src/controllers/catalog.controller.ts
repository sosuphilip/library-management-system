import { Request, Response } from 'express';
import * as catalog from '../services/catalog.service';
import { asyncHandler } from '../utils/asyncHandler';

// Books ---------------------------------------------------------

export const listBooks = asyncHandler(async (req: Request, res: Response) => {
  const { q, category, availability } = req.query as {
    q?: string;
    category?: string;
    availability?: 'available' | 'all';
  };
  const result = await catalog.listBooks({
    q,
    category,
    availability: availability ?? 'all',
    ...req.pagination
  });
  res.json(result);
});

export const getBook = asyncHandler(async (req: Request, res: Response) => {
  const book = await catalog.getBook(req.params.id);
  res.json({ book });
});

export const createBook = asyncHandler(async (req: Request, res: Response) => {
  const book = await catalog.createBook(req.body);
  res.status(201).json({ book });
});

export const updateBook = asyncHandler(async (req: Request, res: Response) => {
  const book = await catalog.updateBook(req.params.id, req.body);
  res.json({ book });
});

export const deleteBook = asyncHandler(async (req: Request, res: Response) => {
  await catalog.deleteBook(req.params.id);
  res.status(204).send();
});

// ISBN lookup ---------------------------------------------------

export const lookupIsbn = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalog.lookupIsbn(req.params.isbn);
  res.json({ book: result });
});

// Copies --------------------------------------------------------

export const addCopy = asyncHandler(async (req: Request, res: Response) => {
  const copy = await catalog.addCopy(req.params.id, req.body);
  res.status(201).json({ copy });
});

export const updateCopy = asyncHandler(async (req: Request, res: Response) => {
  const copy = await catalog.updateCopy(req.params.id, req.body);
  res.json({ copy });
});

export const deleteCopy = asyncHandler(async (req: Request, res: Response) => {
  await catalog.deleteCopy(req.params.id);
  res.status(204).send();
});

// Authors -------------------------------------------------------

export const listAuthors = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalog.listAuthors(req.pagination);
  res.json(result);
});

export const createAuthor = asyncHandler(async (req: Request, res: Response) => {
  const author = await catalog.createAuthor(req.body);
  res.status(201).json({ author });
});

export const updateAuthor = asyncHandler(async (req: Request, res: Response) => {
  const author = await catalog.updateAuthor(req.params.id, req.body);
  res.json({ author });
});

export const deleteAuthor = asyncHandler(async (req: Request, res: Response) => {
  await catalog.deleteAuthor(req.params.id);
  res.status(204).send();
});

// Categories ----------------------------------------------------

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalog.listCategories(req.pagination);
  res.json(result);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await catalog.createCategory(req.body);
  res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await catalog.updateCategory(req.params.id, req.body);
  res.json({ category });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await catalog.deleteCategory(req.params.id);
  res.status(204).send();
});
