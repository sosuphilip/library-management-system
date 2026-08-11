import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password,
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100)
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required')
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required')
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required')
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'token is required'),
  password
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password
});

/** Staff-account creation (Admin only). */
export const createStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(['ADMIN', 'LIBRARIAN'])
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
