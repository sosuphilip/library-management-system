import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Append an entry to the audit log. Never throws — auditing is best-effort. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        actorId: entry.actorId ?? null,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  } catch (error) {
    console.error('Audit write failed', error);
  }
}
