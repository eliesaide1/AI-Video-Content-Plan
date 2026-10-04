import { Router } from 'express';
import { asyncHandler, validateRequest } from '../middleware/index.js';
import { teaserService } from '../application/TeaserService.js';
import { ok } from './respond.js';
import { courseIdParams, listQuery } from './validators.js';

export const teaserRouter = Router();

// GET /api/teasers
teaserRouter.get(
  '/',
  validateRequest({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const teasers = await teaserService.list(Number(req.query.limit) || 50);
    ok(res, teasers);
  }),
);

// GET /api/teasers/course/:courseId
teaserRouter.get(
  '/course/:courseId',
  validateRequest({ params: courseIdParams }),
  asyncHandler(async (req, res) => {
    const teaser = await teaserService.getByCourseId(req.params.courseId);
    ok(res, teaser.toObject());
  }),
);

// GET /api/teasers/course/:courseId/markdown — teaser.md content
teaserRouter.get(
  '/course/:courseId/markdown',
  validateRequest({ params: courseIdParams }),
  asyncHandler(async (req, res) => {
    const { teaser, markdown } = await teaserService.readMarkdown(req.params.courseId);
    ok(res, {
      courseId: req.params.courseId,
      path: teaser.markdownPath,
      markdown,
      beats: teaser.beats,
      duration: teaser.duration,
    });
  }),
);
