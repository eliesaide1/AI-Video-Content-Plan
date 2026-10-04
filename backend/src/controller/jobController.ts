import { Router } from 'express';
import { asyncHandler, validateRequest } from '../middleware/index.js';
import { jobService } from '../application/JobService.js';
import { ok } from './respond.js';
import { idParams, listQuery } from './validators.js';

export const jobRouter = Router();

// GET /api/jobs — Generation screen
jobRouter.get(
  '/',
  validateRequest({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const jobs = await jobService.list({
      status: req.query.status as string | undefined,
      limit: Number(req.query.limit) || 30,
    });
    ok(res, jobs);
  }),
);

// GET /api/jobs/:id — snapshot; live updates arrive over socket.io
jobRouter.get(
  '/:id',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const job = await jobService.getById(req.params.id);
    ok(res, job.toObject());
  }),
);
