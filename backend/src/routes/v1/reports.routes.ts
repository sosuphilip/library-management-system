import { Router } from 'express';
import * as reportsController from '../../controllers/reports.controller';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { reportKindParamsSchema, topBooksQuerySchema } from '../../schemas/reports.schema';

const router = Router();
const reporter = requireRole('LIBRARIAN', 'ADMIN');

router.get('/dashboard', requireAuth, reporter, reportsController.dashboard);
router.get('/most-borrowed', requireAuth, reporter, validate({ query: topBooksQuerySchema }), reportsController.mostBorrowed);
router.get('/overdue', requireAuth, reporter, reportsController.overdue);
router.get('/member-activity', requireAuth, reporter, reportsController.memberActivity);
router.get('/recent-checkouts', requireAuth, reporter, reportsController.recentCheckouts);
router.get(
  '/export/:kind',
  requireAuth,
  reporter,
  validate({ params: reportKindParamsSchema }),
  reportsController.exportCsv
);

export default router;
