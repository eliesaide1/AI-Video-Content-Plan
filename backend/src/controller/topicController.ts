import { Router } from 'express';
import { asyncHandler, validateRequest } from '../middleware/index.js';
import { generationOrchestrator } from '../application/GenerationOrchestrator.js';
import { topicService } from '../application/TopicService.js';
import type { Audience, CourseDepth } from '../model/enums.js';
import { accepted, created, ok } from './respond.js';
import {
  approveTopicBody,
  createTopicBody,
  discoveryBody,
  idParams,
  listTopicsQuery,
  rejectTopicBody,
} from './validators.js';

/**
 * Topic endpoints. Controllers only: validate -> call a service -> respond.
 * No business logic lives here.
 */
export const topicRouter = Router();

// GET /api/topics
topicRouter.get(
  '/',
  validateRequest({ query: listTopicsQuery }),
  asyncHandler(async (req, res) => {
    const topics = await topicService.list(req.query as Record<string, never>);
    ok(res, topics);
  }),
);

// POST /api/topics — manual topic entry
topicRouter.post(
  '/',
  validateRequest({ body: createTopicBody }),
  asyncHandler(async (req, res) => {
    const topic = await topicService.create(req.body);
    created(res, topic.toObject());
  }),
);

// POST /api/topics/discover — run automated discovery (async job)
topicRouter.post(
  '/discover',
  validateRequest({ body: discoveryBody }),
  asyncHandler(async (req, res) => {
    const job = await generationOrchestrator.startDiscovery(req.body.maxCandidates);
    accepted(res, job);
  }),
);

// GET /api/topics/:id
topicRouter.get(
  '/:id',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const topic = await topicService.getById(req.params.id);
    ok(res, topic.toObject());
  }),
);

// POST /api/topics/:id/approve — the human approval gate
topicRouter.post(
  '/:id/approve',
  validateRequest({ params: idParams, body: approveTopicBody }),
  asyncHandler(async (req, res) => {
    const topic = await topicService.approve(req.params.id, {
      audience: req.body.audience as Audience | undefined,
      desiredDepth: req.body.desiredDepth as CourseDepth | undefined,
    });
    ok(res, topic.toObject());
  }),
);

// POST /api/topics/:id/reject
topicRouter.post(
  '/:id/reject',
  validateRequest({ params: idParams, body: rejectTopicBody }),
  asyncHandler(async (req, res) => {
    const topic = await topicService.reject(req.params.id, req.body.reason);
    ok(res, topic.toObject());
  }),
);

// POST /api/topics/:id/research — research only, so a human can review MASTER.md
topicRouter.post(
  '/:id/research',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const job = await generationOrchestrator.startResearch(req.params.id);
    accepted(res, job);
  }),
);

// POST /api/topics/:id/generate — the whole V1 pipeline
topicRouter.post(
  '/:id/generate',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const job = await generationOrchestrator.startFullPipeline(req.params.id);
    accepted(res, job);
  }),
);
