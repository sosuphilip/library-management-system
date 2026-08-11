import prisma from '../lib/prisma';
import { env } from './env';

export const policy = {
  defaultLoanPeriodDays: env.DEFAULT_LOAN_PERIOD_DAYS,
  maxRenewals: env.MAX_RENEWALS,
  fineRatePerDay: env.FINE_RATE_PER_DAY,
  graceDays: env.OVERDUE_FREE_GRACE_DAYS,
  maxOverdueItemsBeforeSuspend: env.MAX_OVERDUE_ITEMS_BEFORE_SUSPEND,
  maxUnpaidFineBeforeSuspend: env.MAX_UNPAID_FINE_BEFORE_SUSPEND,
  suspensionDays: env.SUSPENSION_DAYS,
  holdAvailableGraceDays: env.HOLD_AVAILABLE_GRACE_DAYS
};

/** Effective loan period for a book — category override wins, else global default. */
export async function loanPeriodDaysForBook(bookId: string): Promise<number> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { categories: { include: { category: true }, take: 1 } }
  });
  const override = book?.categories[0]?.category.loanPeriodDays;
  return override ?? policy.defaultLoanPeriodDays;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days a loan was (or is) overdue, after grace. Negative → not overdue.
 *
 * A 1s epsilon absorbs sub-second clock/storage drift so a return landing on an
 * exact day boundary (e.g. due at 12:00:00, returned at 12:00:00.050 five days
 * later) is still counted as 5 days, not 6. Partial days still round up — a
 * return 1 hour late is 1 day.
 */
export function overdueDays(dueDate: Date, asOf: Date, graceDays: number = policy.graceDays): number {
  const ms = asOf.getTime() - dueDate.getTime() - graceDays * DAY_MS;
  if (ms <= 0) return 0;
  return Math.ceil((ms - 1000) / DAY_MS);
}

export { prisma };
