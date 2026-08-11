import prisma from '../lib/prisma';
import { buildPaginated, prismaPagination, Paginated } from '../utils/pagination';
import { audit } from './audit.service';
import { notFound, badRequest, conflict } from '../utils/httpError';
import type { User } from '@prisma/client';
import { policy } from '../config/policy';

export interface MemberListParams {
  page: number;
  limit: number;
  q?: string;
  status?: string;
}

export async function listMembers(params: MemberListParams): Promise<Paginated<Partial<User>>> {
  const where = {
    role: 'MEMBER' as const,
    ...(params.q
      ? {
          OR: [
            { email: { contains: params.q, mode: 'insensitive' as const } },
            { firstName: { contains: params.q, mode: 'insensitive' as const } },
            { lastName: { contains: params.q, mode: 'insensitive' as const } },
            { membershipNumber: { contains: params.q, mode: 'insensitive' as const } }
          ]
        }
      : {}),
    ...(params.status ? { status: params.status as User['status'] } : {})
  };

  const { take, skip } = prismaPagination({ page: params.page, limit: params.limit });
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        suspendedUntil: true,
        membershipNumber: true,
        createdAt: true,
        _count: { select: { loans: true, fines: { where: { status: 'UNPAID' } } } }
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip
    }),
    prisma.user.count({ where })
  ]);
  return buildPaginated(items, total, { page: params.page, limit: params.limit });
}

export async function getMember(id: string) {
  const member = await prisma.user.findUnique({
    where: { id, role: 'MEMBER' },
    include: {
      _count: { select: { loans: true } }
    }
  });
  if (!member) throw notFound('Member not found');
  return member;
}

/** Full member dossier used on the detail page. */
export async function getMemberDossier(id: string) {
  const member = await getMember(id);

  const [activeLoans, loanHistory, reservations, fines, unpaidAgg, overdueCount] =
    await Promise.all([
      prisma.loan.findMany({
        where: { userId: id, status: 'ACTIVE' },
        include: { copy: { include: { book: true } } },
        orderBy: { dueDate: 'asc' }
      }),
      prisma.loan.findMany({
        where: { userId: id },
        include: { copy: { include: { book: true } }, fines: true },
        orderBy: { checkedOutAt: 'desc' },
        take: 20
      }),
      prisma.reservation.findMany({
        where: { userId: id },
        include: { book: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.fine.findMany({
        where: { userId: id },
        include: { loan: { include: { copy: { include: { book: true } } } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.fine.aggregate({
        where: { userId: id, status: 'UNPAID' },
        _sum: { balance: true }
      }),
      prisma.loan.count({
        where: { userId: id, status: 'ACTIVE', dueDate: { lt: new Date() } }
      })
    ]);

  return {
    member,
    stats: {
      totalLoans: member._count.loans,
      activeLoans: activeLoans.length,
      overdueLoans: overdueCount,
      unpaidFines: Number(unpaidAgg._sum.balance ?? 0)
    },
    activeLoans,
    loanHistory,
    reservations,
    fines
  };
}

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

export async function updateMember(id: string, input: UpdateMemberInput, actorId: string) {
  await getMember(id);
  const member = await prisma.user.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone === undefined ? undefined : input.phone
    }
  });
  await audit({
    action: 'MEMBER.UPDATE',
    entityType: 'USER',
    entityId: id,
    actorId,
    metadata: { ...input }
  });
  return member;
}

// ---------------------------------------------------------------
// Manual suspend / reinstate (staff)
// ---------------------------------------------------------------

export async function suspendMember(id: string, actorId: string, days = policy.suspensionDays) {
  await getMember(id);
  const member = await prisma.user.update({
    where: { id },
    data: {
      status: 'SUSPENDED',
      suspendedUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    }
  });
  await audit({
    action: 'MEMBER.SUSPEND',
    entityType: 'USER',
    entityId: id,
    actorId,
    metadata: { days }
  });
  return member;
}

export async function reinstateMember(id: string, actorId: string) {
  await getMember(id);
  const member = await prisma.user.update({
    where: { id },
    data: { status: 'ACTIVE', suspendedUntil: null }
  });
  await audit({
    action: 'MEMBER.REINSTATE',
    entityType: 'USER',
    entityId: id,
    actorId
  });
  return member;
}

// ---------------------------------------------------------------
// Staff-facing fine adjustments
// ---------------------------------------------------------------

export async function adjustFine(id: string, input: { reason: string; amount?: number }, actorId: string) {
  const fine = await prisma.fine.findUnique({ where: { id } });
  if (!fine) throw notFound('Fine not found');
  if (fine.status !== 'UNPAID') throw conflict('This fine is already settled');

  if (input.amount === undefined) {
    // No amount → treat as a waive (full adjustment)
    const updated = await prisma.fine.update({
      where: { id },
      data: { status: 'WAIVED', balance: 0, settledAt: new Date() }
    });
    await prisma.finePayment.create({
      data: { fineId: id, amount: Number(fine.balance), method: 'WAIVE', reason: input.reason, createdById: actorId }
    });
    await audit({ action: 'FINE.WAIVE', entityType: 'FINE', entityId: id, actorId, metadata: { reason: input.reason } });
    return updated;
  }

  const remaining = Number(fine.balance) - input.amount;
  if (remaining < -0.0001) throw badRequest('Adjustment exceeds the outstanding balance');
  await prisma.finePayment.create({
    data: { fineId: id, amount: input.amount, method: 'ADJUSTMENT', reason: input.reason, createdById: actorId }
  });
  const settled = remaining <= 0.0001;
  const updated = await prisma.fine.update({
    where: { id },
    data: {
      balance: settled ? 0 : remaining,
      ...(settled ? { status: 'PAID', settledAt: new Date() } : {})
    }
  });
  await audit({ action: 'FINE.ADJUST', entityType: 'FINE', entityId: id, actorId, metadata: { amount: input.amount } });
  return updated;
}
