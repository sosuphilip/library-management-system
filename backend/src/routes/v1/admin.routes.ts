import { Router } from 'express';
import * as adminController from '../../controllers/admin.controller';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { auditQuerySchema, templateParamsSchema, templateSchema } from '../../schemas/admin.schema';

const router = Router();
const admin = requireRole('ADMIN');

router.get(
  '/audit',
  requireAuth,
  admin,
  validate({ query: auditQuerySchema }),
  adminController.listAudit
);
router.get('/audit/entity-types', requireAuth, admin, adminController.auditEntityTypes);
router.get('/templates', requireAuth, admin, adminController.listTemplates);
router.put(
  '/templates/:type',
  requireAuth,
  admin,
  validate({ params: templateParamsSchema, body: templateSchema }),
  adminController.upsertTemplate
);

export default router;
