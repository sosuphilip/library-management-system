import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { listNotifications } from '../../services/notification.service';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

// A member can view their own notifications
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = await listNotifications(req.user!.id, Number(req.query.limit) || 50);
    res.json({ notifications });
  })
);

export default router;
