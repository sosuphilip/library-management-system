import { Request, Response } from 'express';
import * as admin from '../services/admin.service';
import * as notifications from '../services/notification.service';
import { asyncHandler } from '../utils/asyncHandler';
import { NotificationType } from '@prisma/client';

export const listAudit = asyncHandler(async (req: Request, res: Response) => {
  const result = await admin.listAuditLogs(
    {
      action: req.query.action as string | undefined,
      entityType: req.query.entityType as string | undefined
    },
    req.pagination.page,
    req.pagination.limit
  );
  res.json(result);
});

export const auditEntityTypes = asyncHandler(async (_req: Request, res: Response) => {
  const types = await admin.auditEntityTypes();
  res.json({ entityTypes: types });
});

export const listTemplates = asyncHandler(async (_req: Request, res: Response) => {
  const templates = await notifications.listTemplates();
  res.json({ templates });
});

export const upsertTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await notifications.upsertTemplate(
    req.params.type as NotificationType,
    req.body.subject,
    req.body.body,
    req.user!.id
  );
  res.json({ template });
});
