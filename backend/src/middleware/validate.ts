import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { badRequest } from '../utils/httpError';

/**
 * Validate request parts against a Zod schema.
 *   router.post('/x', validate({ body: schema }), handler)
 * On failure, responds 400 with a structured field-error list.
 */
export const validate =
  (schemas: { body?: AnyZodObject; query?: AnyZodObject; params?: AnyZodObject }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as Record<string, string>;
      if (schemas.params) req.params = schemas.params.parse(req.params) as Record<string, string>;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message
        }));
        next(badRequest('Validation failed', details));
        return;
      }
      next(error);
    }
  };
