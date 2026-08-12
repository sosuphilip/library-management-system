import type { Fine, Loan, Reservation, ReservationStatus, User } from '@prisma/client';
import prisma from '../lib/prisma';
import { conflict, notFound, forbidden, badRequest } from '../utils/httpError';
import { buildPaginated, prismaPagination, Paginated } from '../utils/pagination';
import { audit } from './audit.service';
import { loanPeriodDaysForBook, overdueDays, policy } from '../config/policy';
import { renderTemplate, resolveTemplateFromDb, sendNotification } from './notification.service';

// ---------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------

export async function checkout(
  copyId: string,
  userId: string,
  actorId: string
): Promise<Loan> {
  const copy = await prisma.copy.findUnique({
    where: { id: copyId },
    include: { book: true }
  });
  if (!copy) throw notFound('Copy not found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Member not found');
  if (user.status !== 'ACTIVE') {
    throw forbidden('This member is suspended and cannot check out items');
  }

  if (copy.status !== 'AVAILABLE') {
    throw conflict(`This copy is ${copy.status.toLowerCase()} and cannot be checked out`);
  }

  // Hold discipline: a READY hold allocated to this copy belongs to exactly one member
  const allocated = await prisma.reservation.findFirst({
    where: { copyId, status: 'READY' }
  });
  if (allocated && allocated.userId !== userId) {
    throw conflict('This copy is reserved for another member');
  }
  if (allocated && allocated.userId === userId) {
    // Borrower fulfils their own hold
    await prisma.reservation.update({
      where: { id: allocated.id },
      data: { status: 'FULFILLED', fulfilledAt: new Date() }
    });
  }

  const loanPeriod = await loanPeriodDaysForBook(copy.bookId);
  const dueDate = new Date(Date.now() + loanPeriod * 24 * 60 * 60 * 1000);

  const loan = await prisma.loan.create({
    data: {
      copyId,
      userId,
      bookId: copy.bookId,
      dueDate,
      maxRenewals: policy.maxRenewals,
      fineRate: policy.fineRatePerDay
    },
    include: { copy: { include: { book: true } }, user: true }
  });

  await prisma.copy.update({
    where: { id: copyId },
    data: { status: 'CHECKED_OUT', dueDate }
  });

  await audit({
    action: 'LOAN.CHECKOUT',
    entityType: 'LOAN',
    entityId: loan.id,
    actorId,
    metadata: { copyId, userId, dueDate: dueDate.toISOString() }
  });

  return loan;
}

// ---------------------------------------------------------------
// Return
// ---------------------------------------------------------------

export async function returnBook(copyId: string, actorId: string): Promise<{ loan: Loan; fine?: Fine }> {
  const copy = await prisma.copy.findUnique({ where: { id: copyId } });
  if (!copy) throw notFound('Copy not found');

  const loan = await prisma.loan.findFirst({
    where: { copyId, status: 'ACTIVE' },
    orderBy: { checkedOutAt: 'desc' }
  });
  if (!loan) throw conflict('This copy is not currently checked out');

  const now = new Date();
  const days = overdueDays(loan.dueDate, now);
  let fine: Fine | undefined;

  if (days > 0) {
    const amount = Number(loan.fineRate) * days;
    fine = await prisma.fine.create({
      data: {
        loanId: loan.id,
        userId: loan.userId,
        amount,
        balance: amount,
        reason: `Late return — ${days} day(s) overdue`
      }
    });

    // Tell the member about the fine (template is admin-editable)
    const user = await prisma.user.findUnique({ where: { id: loan.userId } });
    const tpl = await resolveTemplateFromDb('FINE_CHARGED');
    const { subject, body } = renderTemplate(tpl, {
      firstName: user?.firstName ?? 'there',
      amount: `$${amount.toFixed(2)}`,
      reason: fine.reason
    });
    await sendNotification({
      userId: loan.userId,
      type: 'FINE_CHARGED',
      subject,
      body,
      relatedLoanId: loan.id
    });
  }

  await prisma.$transaction([
    prisma.loan.update({
      where: { id: loan.id },
      data: { status: 'RETURNED', returnedAt: now }
    }),
    prisma.copy.update({
      where: { id: copyId },
      data: { status: 'AVAILABLE', dueDate: null }
    })
  ]);

  await audit({
    action: 'LOAN.RETURN',
    entityType: 'LOAN',
    entityId: loan.id,
    actorId,
    metadata: { copyId, fineCreated: Boolean(fine) }
  });

  // Fulfil the next waiting hold for this book by allocating the freed copy
  await allocateNextHold(copy.bookId, copyId);

  await evaluateSuspension(loan.userId);

  return { loan: { ...loan, status: 'RETURNED', returnedAt: now }, fine };
}

// ---------------------------------------------------------------
// Renew
// ---------------------------------------------------------------

export async function renewLoan(loanId: string, actorId: string): Promise<Loan> {
  const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { copy: true } });
  if (!loan) throw notFound('Loan not found');
  if (loan.status !== 'ACTIVE') throw conflict('Only active loans can be renewed');

  if (loan.dueDate < new Date()) {
    throw conflict('Overdue loans cannot be renewed — please return the item');
  }
  if (loan.renewals >= loan.maxRenewals) {
    throw conflict('This loan has already reached its renewal limit');
  }

  const loanPeriod = await loanPeriodDaysForBook(loan.bookId);
  const dueDate = new Date(loan.dueDate.getTime() + loanPeriod * 24 * 60 * 60 * 1000);

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { dueDate, renewals: { increment: 1 } }
  });

  await prisma.copy.update({
    where: { id: loan.copyId },
    data: { dueDate }
  });

  await audit({
    action: 'LOAN.RENEW',
    entityType: 'LOAN',
    entityId: loanId,
    actorId,
    metadata: { newDueDate: dueDate.toISOString() }
  });

  return updated;
}

// ---------------------------------------------------------------
// Reservations / holds
// ---------------------------------------------------------------

export async function reserveBook(bookId: string, userId: string): Promise<Reservation> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      copies: { where: { status: 'AVAILABLE' } },
      reservations: { where: { status: { in: ['WAITING', 'READY'] } } }
    }
  });
  if (!book) throw notFound('Book not found');

  const alreadyHolding = book.reservations.some((r) => r.userId === userId);
  if (alreadyHolding) throw conflict('You already have an active hold on this book');

  const position = book.reservations.length + 1;

  // If a copy is free right now, the hold is immediately ready
  let copyId: string | null | undefined = null;
  let status: ReservationStatus = 'WAITING';
  let readyAt: Date | null = null;
  let expiresAt: Date | null = null;

  const freeCopy = book.copies.find((c) => c.status === 'AVAILABLE');
  if (freeCopy) {
    copyId = freeCopy.id;
    status = 'READY';
    readyAt = new Date();
    expiresAt = new Date(Date.now() + policy.holdAvailableGraceDays * 24 * 60 * 60 * 1000);
  }

  const reservation = await prisma.reservation.create({
    data: {
      bookId,
      userId,
      copyId: copyId ?? undefined,
      status,
      position,
      readyAt,
      expiresAt
    }
  });

  await audit({
    action: 'RESERVATION.CREATE',
    entityType: 'RESERVATION',
    entityId: reservation.id,
    actorId: userId,
    metadata: { bookId, status }
  });

  if (status === 'READY') {
    await notifyHoldAvailable(reservation.id);
  }

  return reservation;
}

/** Promote the next WAITING hold to READY and allocate the freed copy. */
async function allocateNextHold(bookId: string, freedCopyId: string): Promise<void> {
  const next = await prisma.reservation.findFirst({
    where: { bookId, status: 'WAITING' },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
  });
  if (!next) return;

  const copy = await prisma.copy.findUnique({ where: { id: freedCopyId } });
  if (!copy || copy.status !== 'AVAILABLE') return;

  const now = new Date();
  const updated = await prisma.reservation.update({
    where: { id: next.id },
    data: {
      status: 'READY',
      copyId: freedCopyId,
      readyAt: now,
      expiresAt: new Date(now.getTime() + policy.holdAvailableGraceDays * 24 * 60 * 60 * 1000)
    }
  });
  await notifyHoldAvailable(updated.id);
}

export async function cancelReservation(reservationId: string, userId: string): Promise<void> {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) throw notFound('Reservation not found');
  if (reservation.userId !== userId) throw forbidden('You can only cancel your own holds');

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: 'CANCELLED', cancelledAt: new Date() }
  });

  await audit({
    action: 'RESERVATION.CANCEL',
    entityType: 'RESERVATION',
    entityId: reservationId,
    actorId: userId
  });
}

/** Expire READY holds whose grace period lapsed (called by cron + return sweep).
 *  Each expired hold notifies its owner (template is admin-editable). */
export async function expireStaleReadyHolds(): Promise<number> {
  const stale = await prisma.reservation.findMany({
    where: { status: 'READY', expiresAt: { lt: new Date() } },
    include: { user: true, book: true }
  });
  if (stale.length === 0) return 0;

  await prisma.reservation.updateMany({
    where: { id: { in: stale.map((r) => r.id) } },
    data: { status: 'EXPIRED' }
  });

  for (const reservation of stale) {
    const tpl = await resolveTemplateFromDb('HOLD_EXPIRED');
    const { subject, body } = renderTemplate(tpl, {
      firstName: reservation.user.firstName,
      bookTitle: reservation.book.title,
      expiresAt: reservation.expiresAt ? reservation.expiresAt.toISOString().slice(0, 10) : ''
    });
    await sendNotification({
      userId: reservation.userId,
      type: 'HOLD_EXPIRED',
      subject,
      body,
      relatedReservationId: reservation.id
    });
  }

  return stale.length;
}

// ---------------------------------------------------------------
// Fines
// ---------------------------------------------------------------

export async function payFine(fineId: string, amount: number, method: string, actorId: string): Promise<Fine> {
  const fine = await prisma.fine.findUnique({ where: { id: fineId } });
  if (!fine) throw notFound('Fine not found');
  if (fine.status !== 'UNPAID') throw conflict('This fine is already settled');

  const remaining = Number(fine.balance) - amount;
  if (remaining < -0.0001) throw badRequest('Payment exceeds the outstanding balance');

  await prisma.finePayment.create({
    data: {
      fineId,
      amount,
      method,
      reason: 'Payment',
      createdById: actorId
    }
  });

  const settled = remaining <= 0.0001;
  const updated = await prisma.fine.update({
    where: { id: fineId },
    data: {
      balance: settled ? 0 : remaining,
      ...(settled ? { status: 'PAID', settledAt: new Date() } : {})
    }
  });

  await audit({
    action: 'FINE.PAY',
    entityType: 'FINE',
    entityId: fineId,
    actorId,
    metadata: { amount, method }
  });

  await evaluateSuspension(fine.userId);
  return updated;
}

export async function waiveFine(fineId: string, reason: string, actorId: string): Promise<Fine> {
  const fine = await prisma.fine.findUnique({ where: { id: fineId } });
  if (!fine) throw notFound('Fine not found');
  if (fine.status !== 'UNPAID') throw conflict('This fine is already settled');

  const updated = await prisma.fine.update({
    where: { id: fineId },
    data: { status: 'WAIVED', balance: 0, settledAt: new Date() }
  });
  await prisma.finePayment.create({
    data: {
      fineId,
      amount: Number(fine.balance),
      method: 'WAIVE',
      reason,
      createdById: actorId
    }
  });

  await audit({
    action: 'FINE.WAIVE',
    entityType: 'FINE',
    entityId: fineId,
    actorId,
    metadata: { reason }
  });

  await evaluateSuspension(fine.userId);
  return updated;
}

// ---------------------------------------------------------------
// Listing
// ---------------------------------------------------------------

export async function listLoans(params: {
  page: number;
  limit: number;
  status?: string;
  userId?: string;
}): Promise<Paginated<Loan>> {
  const where = {
    ...(params.status ? { status: params.status as Loan['status'] } : {}),
    ...(params.userId ? { userId: params.userId } : {})
  };
  const { take, skip } = prismaPagination({ page: params.page, limit: params.limit });
  const [items, total] = await prisma.$transaction([
    prisma.loan.findMany({
      where,
      include: {
        copy: { include: { book: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { checkedOutAt: 'desc' },
      take,
      skip
    }),
    prisma.loan.count({ where })
  ]);
  return buildPaginated(items, total, { page: params.page, limit: params.limit });
}

export async function listMyLoans(userId: string, status?: string) {
  const where = { userId, ...(status ? { status: status as Loan['status'] } : {}) };
  return prisma.loan.findMany({
    where,
    include: { copy: { include: { book: true } } },
    orderBy: { checkedOutAt: 'desc' }
  });
}

export async function listMyReservations(userId: string) {
  return prisma.reservation.findMany({
    where: { userId },
    include: { book: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listMyFines(userId: string) {
  return prisma.fine.findMany({
    where: { userId },
    include: { loan: { include: { copy: { include: { book: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
}

// ---------------------------------------------------------------
// Suspension policy
// ---------------------------------------------------------------

export async function evaluateSuspension(userId: string): Promise<User | null> {
  const [overdueCount, unpaidAgg] = await Promise.all([
    prisma.loan.count({
      where: { userId, status: 'ACTIVE', dueDate: { lt: new Date() } }
    }),
    prisma.fine.aggregate({
      where: { userId, status: 'UNPAID' },
      _sum: { balance: true }
    })
  ]);

  const unpaidTotal = Number(unpaidAgg._sum.balance ?? 0);
  const shouldSuspend =
    overdueCount >= policy.maxOverdueItemsBeforeSuspend ||
    unpaidTotal >= policy.maxUnpaidFineBeforeSuspend;

  if (!shouldSuspend) return null;

  const until = new Date(Date.now() + policy.suspensionDays * 24 * 60 * 60 * 1000);
  return prisma.user.update({
    where: { id: userId },
    data: { status: 'SUSPENDED', suspendedUntil: until }
  });
}

// ---------------------------------------------------------------
// Notifications (used by circulation + cron)
// ---------------------------------------------------------------

async function notifyHoldAvailable(reservationId: string): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { user: true, book: true }
  });
  if (!reservation || reservation.notifiedAt) return;

  const tpl = await resolveTemplateFromDb('HOLD_AVAILABLE');
  const { subject, body } = renderTemplate(tpl, {
    firstName: reservation.user.firstName,
    bookTitle: reservation.book.title,
    expiresAt: reservation.expiresAt ? reservation.expiresAt.toISOString().slice(0, 10) : ''
  });
  const record = await sendNotification({
    userId: reservation.userId,
    type: 'HOLD_AVAILABLE',
    subject,
    body,
    relatedReservationId: reservation.id
  });
  // Only mark notified on success so a failed send is retried on next trigger
  if (record.status === 'SENT') {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { notifiedAt: new Date() }
    });
  }
}

export type { Loan };
