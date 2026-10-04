import { Router } from 'express';
import mongoose from 'mongoose';
import { aiEnabled } from '../infrastructure/ai/index.js';
import { config } from '../infrastructure/config.js';
import { realtime } from '../infrastructure/realtime/RealtimeGateway.js';
import { Audience, CourseDepth, CourseLevel, values } from '../model/enums.js';
import { courseRouter } from './courseController.js';
import { jobRouter } from './jobController.js';
import { lessonRouter } from './lessonController.js';
import { researchRouter } from './researchController.js';
import { teaserRouter } from './teaserController.js';
import { topicRouter } from './topicController.js';
import { ok } from './respond.js';

/** Single place where the HTTP surface is assembled. */
export const apiRouter = Router();

// GET /api/health
apiRouter.get('/health', (_req, res) => {
  ok(res, {
    status: 'ok',
    env: config.env,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    realtime: realtime.isAttached ? 'attached' : 'detached',
    aiProvider: aiEnabled ? config.ai.provider : 'mock',
    aiModel: aiEnabled ? config.ai.model : 'mock-ai',
    time: new Date().toISOString(),
  });
});

// GET /api/meta — vocabulary the frontend dropdowns need
apiRouter.get('/meta', (_req, res) => {
  ok(res, {
    audiences: values(Audience),
    depths: values(CourseDepth),
    levels: values(CourseLevel),
  });
});

apiRouter.use('/topics', topicRouter);
apiRouter.use('/research', researchRouter);
apiRouter.use('/courses', courseRouter);
apiRouter.use('/lessons', lessonRouter);
apiRouter.use('/teasers', teaserRouter);
apiRouter.use('/jobs', jobRouter);
