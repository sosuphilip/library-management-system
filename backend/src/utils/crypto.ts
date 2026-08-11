import crypto from 'node:crypto';

/** Random 32-byte hex token (used for refresh tokens, password resets). */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** SHA-256 hash of a token. We store only the hash in the DB so a leaked
 *  database dump doesn't expose live credentials. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
