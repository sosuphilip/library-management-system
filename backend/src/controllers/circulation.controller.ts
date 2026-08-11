import { Request, Response } from 'express';
import * as circulation from '../services/circulation.service';
import { asyncHandler } from '../utils/asyncHandler';

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const loan = await circulation.checkout(req.body.copyId, req.body.userId, req.user!.id);
  res.status(201).json({ loan });
});

export const returnBook = asyncHandler(async (req: Request, res: Response) => {
  const result = await circulation.returnBook(req.body.copyId, req.user!.id);
  res.json(result);
});

export const renewLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await circulation.renewLoan(req.params.id, req.user!.id);
  res.json({ loan });
});

export const reserveBook = asyncHandler(async (req: Request, res: Response) => {
  const reservation = await circulation.reserveBook(req.body.bookId, req.user!.id);
  res.status(201).json({ reservation });
});

export const cancelReservation = asyncHandler(async (req: Request, res: Response) => {
  await circulation.cancelReservation(req.params.id, req.user!.id);
  res.status(204).send();
});

export const payFine = asyncHandler(async (req: Request, res: Response) => {
  const fine = await circulation.payFine(req.body.fineId, req.body.amount, req.body.method, req.user!.id);
  res.json({ fine });
});

export const waiveFine = asyncHandler(async (req: Request, res: Response) => {
  const fine = await circulation.waiveFine(req.body.fineId, req.body.reason, req.user!.id);
  res.json({ fine });
});

// Staff listings -------------------------------------------------

export const listLoans = asyncHandler(async (req: Request, res: Response) => {
  const result = await circulation.listLoans({
    page: req.pagination.page,
    limit: req.pagination.limit,
    status: req.query.status as string | undefined,
    userId: req.query.userId as string | undefined
  });
  res.json(result);
});

// Member self-service --------------------------------------------

export const myLoans = asyncHandler(async (req: Request, res: Response) => {
  const loans = await circulation.listMyLoans(req.user!.id, req.query.status as string | undefined);
  res.json({ loans });
});

export const myReservations = asyncHandler(async (req: Request, res: Response) => {
  const reservations = await circulation.listMyReservations(req.user!.id);
  res.json({ reservations });
});

export const myFines = asyncHandler(async (req: Request, res: Response) => {
  const fines = await circulation.listMyFines(req.user!.id);
  res.json({ fines });
});
