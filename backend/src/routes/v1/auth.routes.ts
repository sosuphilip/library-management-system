import { Router } from 'express';
import * as authController from '../../controllers/auth.controller';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import {
  changePasswordSchema,
  createStaffSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema
} from '../../schemas/auth.schema';

const router = Router();

// Public
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), authController.refresh);
router.post('/logout', validate({ body: logoutSchema }), authController.logout);

// Password reset (unauthenticated by design)
router.post(
  '/password-reset/request',
  authLimiter,
  validate({ body: requestPasswordResetSchema }),
  authController.requestPasswordReset
);
router.post(
  '/password-reset/confirm',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

// Authenticated
router.get('/me', requireAuth, authController.me);
router.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

// Admin only
router.post(
  '/staff',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createStaffSchema }),
  authController.createStaff
);

export default router;
