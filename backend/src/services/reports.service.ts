import prisma from '../lib/prisma';

export async function dashboardStats() {
  const [books, copies, activeLoans, overdue, members, unpaidAgg, paidAgg, waiveAgg] =
    await Promise.all([
      prisma.book.count(),
      prisma.copy.count(),
      prisma.loan.count({ where: { status: 'ACTIVE' } }),
      prisma.loan.count({ where: { status: 'ACTIVE', dueDate: { lt: new Date() } } }),
      prisma.user.count({ where: { role: 'MEMBER' } }),
      prisma.fine.aggregate({ where: { status: 'UNPAID' }, _sum: { balance: true } }),
      prisma.fine.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.fine.aggregate({ where: { status: 'WAIVED' }, _sum: { amount: true } })
    ]);

  return {
    books,
    copies,
    activeLoans,
    overdueLoans: overdue,
    members,
    outstandingFines: Number(unpaidAgg._sum.balance ?? 0),
    collectedFines: Number(paidAgg._sum.amount ?? 0),
    waivedFines: Number(waiveAgg._sum.amount ?? 0)
  };
}

export async function mostBorrowedBooks(limit = 10) {
  return prisma.book.findMany({
    take: limit,
    orderBy: { loans: { _count: 'desc' } },
    include: {
      authors: { include: { author: true }, orderBy: { position: 'asc' } },
      _count: { select: { loans: true } }
    }
  });
}

export async function overdueLoans() {
  return prisma.loan.findMany({
    where: { status: 'ACTIVE', dueDate: { lt: new Date() } },
    orderBy: { dueDate: 'asc' },
    include: {
      copy: { include: { book: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } }
    }
  });
}

export async function memberActivity(limit = 10) {
  return prisma.user.findMany({
    where: { role: 'MEMBER' },
    take: limit,
    orderBy: { loans: { _count: 'desc' } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      membershipNumber: true,
      createdAt: true,
      _count: { select: { loans: true, reservations: true } }
    }
  });
}

export async function recentCheckouts(limit = 10) {
  return prisma.loan.findMany({
    take: limit,
    orderBy: { checkedOutAt: 'desc' },
    include: {
      copy: { include: { book: true } },
      user: { select: { id: true, firstName: true, lastName: true } }
    }
  });
}

// ---------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------

export type ReportKind = 'books' | 'loans' | 'overdue' | 'fines' | 'members';

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

export async function exportReport(kind: ReportKind): Promise<{ filename: string; csv: string }> {
  switch (kind) {
    case 'books': {
      const books = await prisma.book.findMany({
        include: {
          authors: { include: { author: true }, orderBy: { position: 'asc' } },
          categories: { include: { category: true } },
          _count: { select: { copies: true, loans: true } }
        },
        orderBy: { title: 'asc' }
      });
      const csv = toCsv(
        books.map((b) => ({
          title: b.title,
          isbn: b.isbn,
          publisher: b.publisher,
          year: b.year,
          authors: b.authors.map((a) => a.author.name).join('; '),
          categories: b.categories.map((c) => c.category.name).join('; '),
          copies: b._count.copies,
          loans: b._count.loans
        }))
      );
      return { filename: 'books.csv', csv };
    }

    case 'loans': {
      const loans = await prisma.loan.findMany({
        include: {
          copy: { include: { book: true } },
          user: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { checkedOutAt: 'desc' }
      });
      const csv = toCsv(
        loans.map((l) => ({
          book: l.copy.book.title,
          barcode: l.copy.barcode,
          member: `${l.user.firstName} ${l.user.lastName}`,
          email: l.user.email,
          status: l.status,
          checkedOutAt: l.checkedOutAt.toISOString(),
          dueDate: l.dueDate.toISOString(),
          returnedAt: l.returnedAt?.toISOString() ?? '',
          renewals: l.renewals
        }))
      );
      return { filename: 'loans.csv', csv };
    }

    case 'overdue': {
      const rows = await overdueLoans();
      const csv = toCsv(
        rows.map((l) => ({
          book: l.copy.book.title,
          barcode: l.copy.barcode,
          member: `${l.user.firstName} ${l.user.lastName}`,
          email: l.user.email,
          dueDate: l.dueDate.toISOString(),
          daysOverdue: Math.ceil((Date.now() - l.dueDate.getTime()) / 86_400_000)
        }))
      );
      return { filename: 'overdue.csv', csv };
    }

    case 'fines': {
      const fines = await prisma.fine.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          loan: { include: { copy: { include: { book: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      });
      const csv = toCsv(
        fines.map((f) => ({
          id: f.id,
          member: `${f.user.firstName} ${f.user.lastName}`,
          email: f.user.email,
          book: f.loan?.copy.book.title ?? '',
          amount: Number(f.amount),
          balance: Number(f.balance),
          status: f.status,
          reason: f.reason,
          createdAt: f.createdAt.toISOString()
        }))
      );
      return { filename: 'fines.csv', csv };
    }

    case 'members': {
      const members = await prisma.user.findMany({
        where: { role: 'MEMBER' },
        include: { _count: { select: { loans: true } } },
        orderBy: { createdAt: 'desc' }
      });
      const csv = toCsv(
        members.map((m) => ({
          membershipNumber: m.membershipNumber,
          name: `${m.firstName} ${m.lastName}`,
          email: m.email,
          status: m.status,
          joinedAt: m.createdAt.toISOString(),
          totalLoans: m._count.loans
        }))
      );
      return { filename: 'members.csv', csv };
    }
  }
}
