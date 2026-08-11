import { Router } from 'express';
import * as membersController from '../../controllers/members.controller';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  fineAdjustSchema,
  listMembersQuerySchema,
  memberParamsSchema,
  suspendMemberSchema,
  updateMemberSchema
} from '../../schemas/members.schema';

const router = Router();
const staff = requireRole('LIBRARIAN', 'ADMIN');

// All member-management routes are staff-only
router.get('/', requireAuth, staff, validate({ query: listMembersQuerySchema }), membersController.listMembers);
router.get('/:id', requireAuth, staff, validate({ params: memberParamsSchema }), membersController.getMember);
router.patch(
  '/:id',
  requireAuth,
  staff,
  validate({ params: memberParamsSchema, body: updateMemberSchema }),
  membersController.updateMember
);
router.post(
  '/:id/suspend',
  requireAuth,
  staff,
  validate({ params: memberParamsSchema, body: suspendMemberSchema }),
  membersController.suspendMember
);
router.post(
  '/:id/reinstate',
  requireAuth,
  staff,
  validate({ params: memberParamsSchema }),
  membersController.reinstateMember
);
router.post(
  '/fines/:id/adjust',
  requireAuth,
  staff,
  validate({ params: memberParamsSchema, body: fineAdjustSchema }),
  membersController.adjustFine
);

export default router;
