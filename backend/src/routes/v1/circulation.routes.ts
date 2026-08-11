import { Router } from 'express';
import * as circulationController from '../../controllers/circulation.controller';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  checkoutSchema,
  listLoansQuerySchema,
  loanParamsSchema,
  payFineSchema,
  reserveBookSchema,
  reservationParamsSchema,
  returnBookSchema,
  waiveFineSchema
} from '../../schemas/circulation.schema';

const router = Router();
const staff = requireRole('LIBRARIAN', 'ADMIN');

// ---- Staff operations ----
router.post('/checkout', requireAuth, staff, validate({ body: checkoutSchema }), circulationController.checkout);
router.post('/returns', requireAuth, staff, validate({ body: returnBookSchema }), circulationController.returnBook);
router.post(
  '/loans/:id/renew',
  requireAuth,
  staff,
  validate({ params: loanParamsSchema }),
  circulationController.renewLoan
);

router.get('/loans', requireAuth, staff, validate({ query: listLoansQuerySchema }), circulationController.listLoans);

// Fines (staff can waive; members pay their own)
router.post('/fines/pay', requireAuth, validate({ body: payFineSchema }), circulationController.payFine);
router.post('/fines/waive', requireAuth, staff, validate({ body: waiveFineSchema }), circulationController.waiveFine);

// ---- Member self-service ----
router.get('/me/loans', requireAuth, circulationController.myLoans);
router.get('/me/reservations', requireAuth, circulationController.myReservations);
router.get('/me/fines', requireAuth, circulationController.myFines);

// Holds: any member can place/cancel their own
router.post('/reserve', requireAuth, validate({ body: reserveBookSchema }), circulationController.reserveBook);
router.delete(
  '/reservations/:id',
  requireAuth,
  validate({ params: reservationParamsSchema }),
  circulationController.cancelReservation
);

export default router;
