import prisma from '../lib/prisma';
import { buildPaginated, prismaPagination } from '../utils/pagination';

export interface AuditFilters {
  action?: string;
  entityType?: string;
}

/** Paginated audit-log entries, newest first, with the acting user attached. */
export async function listAuditLogs(filters: AuditFilters, page: number, limit: number) {
  const where = {
    ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' as const } } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {})
  };

  const { take, skip } = prismaPagination({ page, limit });
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
      }
    }),
    prisma.auditLog.count({ where })
  ]);

  return buildPaginated(items, total, { page, limit });
}

/** Distinct entity types present in the audit log (for filter dropdowns). */
export async function auditEntityTypes(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    select: { entityType: true },
    distinct: ['entityType'],
    orderBy: { entityType: 'asc' }
  });
  return rows.map((r) => r.entityType);
}
