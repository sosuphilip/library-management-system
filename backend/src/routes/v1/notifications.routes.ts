import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../../services/notification.service';
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

// Read / unread
router.post(
  '/me/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await markAllNotificationsRead(req.user!.id);
    res.json({ updated: count });
  })
);

router.post(
  '/me/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    await markNotificationRead(req.user!.id, req.params.id);
    res.status(204).send();
  })
);

export default router;
