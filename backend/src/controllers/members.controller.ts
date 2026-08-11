import { Request, Response } from 'express';
import * as members from '../services/members.service';
import { asyncHandler } from '../utils/asyncHandler';

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const result = await members.listMembers({
    page: req.pagination.page,
    limit: req.pagination.limit,
    q: req.query.q as string | undefined,
    status: req.query.status as string | undefined
  });
  res.json(result);
});

export const getMember = asyncHandler(async (req: Request, res: Response) => {
  const dossier = await members.getMemberDossier(req.params.id);
  res.json(dossier);
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await members.updateMember(req.params.id, req.body, req.user!.id);
  res.json({ member });
});

export const suspendMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await members.suspendMember(req.params.id, req.user!.id, req.body.days);
  res.json({ member });
});

export const reinstateMember = asyncHandler(async (req: Request, res: Response) => {
  const member = await members.reinstateMember(req.params.id, req.user!.id);
  res.json({ member });
});

export const adjustFine = asyncHandler(async (req: Request, res: Response) => {
  const fine = await members.adjustFine(req.params.id, req.body, req.user!.id);
  res.json({ fine });
});
