import { Router } from 'express';
import authRouter from './auth.routes';
import catalogRouter from './catalog.routes';
import circulationRouter from './circulation.routes';
import membersRouter from './members.routes';
import reportsRouter from './reports.routes';
import notificationsRouter from './notifications.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRouter);
router.use('/catalog', catalogRouter);
router.use('/circulation', circulationRouter);
router.use('/members', membersRouter);
router.use('/reports', reportsRouter);
router.use('/notifications', notificationsRouter);

export default router;
