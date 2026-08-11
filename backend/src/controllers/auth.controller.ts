import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json({ user: result.user, tokens: result.tokens });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json({ user: result.user, tokens: result.tokens });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.refresh(req.body.refreshToken);
  res.status(200).json({ tokens });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken, req.user?.id);
  res.status(204).send();
});

export const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestPasswordReset(req.body.email);
  res.status(200).json({
    message: 'If that email exists, a reset link has been sent.'
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({ message: 'Password has been reset. You can sign in now.' });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(
    req.user!.id,
    req.body.currentPassword,
    req.body.newPassword
  );
  res.status(200).json({ message: 'Password changed. Please sign in again.' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: authService.toPublicUser(req.user!) });
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.createStaff(req.body);
  res.status(201).json({ user });
});
