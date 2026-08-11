/** Error carrying an HTTP status + optional public detail, used by the
 *  central error handler to produce a consistent JSON error shape. */
export class HttpError extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(status: number, message: string, options?: { details?: unknown; code?: string }) {
    super(message);
    this.status = status;
    this.details = options?.details;
    this.code = options?.code;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, { details });

export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, message, { code: 'UNAUTHORIZED' });

export const forbidden = (message = 'You do not have permission to do this') =>
  new HttpError(403, message, { code: 'FORBIDDEN' });

export const notFound = (message = 'Resource not found') =>
  new HttpError(404, message, { code: 'NOT_FOUND' });

export const conflict = (message: string) => new HttpError(409, message, { code: 'CONFLICT' });

export const tooManyRequests = (message = 'Too many requests, please slow down') =>
  new HttpError(429, message, { code: 'RATE_LIMITED' });
