import { Router } from 'express';
import { asyncHandler, validateRequest } from '../middleware/index.js';
import { researchService } from '../application/ResearchService.js';
import { ok } from './respond.js';
import { topicIdParams } from './validators.js';

export const researchRouter = Router();

// GET /api/research/topic/:topicId — research metadata, claims and sources
researchRouter.get(
  '/topic/:topicId',
  validateRequest({ params: topicIdParams }),
  asyncHandler(async (req, res) => {
    const research = await researchService.getByTopicId(req.params.topicId);
    ok(res, research.toObject());
  }),
);

// GET /api/research/topic/:topicId/master — MASTER.md content for the Research screen
researchRouter.get(
  '/topic/:topicId/master',
  validateRequest({ params: topicIdParams }),
  asyncHandler(async (req, res) => {
    const research = await researchService.getByTopicId(req.params.topicId);
    const markdown = await researchService.readMaster(research);
    ok(res, {
      topicId: req.params.topicId,
      path: research.masterMarkdownPath,
      markdown,
      sources: research.sources,
      claims: research.claims,
    });
  }),
);
