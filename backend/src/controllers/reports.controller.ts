import { Request, Response } from 'express';
import * as reports from '../services/reports.service';
import { asyncHandler } from '../utils/asyncHandler';

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await reports.dashboardStats();
  res.json({ stats });
});

export const mostBorrowed = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const books = await reports.mostBorrowedBooks(limit);
  res.json({ books });
});

export const overdue = asyncHandler(async (_req: Request, res: Response) => {
  const loans = await reports.overdueLoans();
  res.json({ loans });
});

export const memberActivity = asyncHandler(async (req: Request, res: Response) => {
  const members = await reports.memberActivity(Number(req.query.limit) || 10);
  res.json({ members });
});

export const recentCheckouts = asyncHandler(async (_req: Request, res: Response) => {
  const loans = await reports.recentCheckouts(10);
  res.json({ loans });
});

export const exportCsv = asyncHandler(async (req: Request, res: Response) => {
  const { filename, csv } = await reports.exportReport(req.params.kind as reports.ReportKind);
  res
    .set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    })
    .send(csv);
});
