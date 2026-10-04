import { Router } from 'express';
import { asyncHandler, validateRequest } from '../middleware/index.js';
import { generationOrchestrator } from '../application/GenerationOrchestrator.js';
import { lessonService } from '../application/LessonService.js';
import { accepted, ok } from './respond.js';
import { idParams, lessonMarkdownBody } from './validators.js';

export const lessonRouter = Router();

// GET /api/lessons/:id
lessonRouter.get(
  '/:id',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const lesson = await lessonService.getById(req.params.id);
    ok(res, lesson.toObject());
  }),
);

// GET /api/lessons/:id/markdown — Lesson Editor loads this
lessonRouter.get(
  '/:id/markdown',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const { lesson, markdown } = await lessonService.readMarkdown(req.params.id);
    ok(res, { lessonId: lesson.id, title: lesson.title, path: lesson.markdownPath, markdown });
  }),
);

// PUT /api/lessons/:id/markdown — Lesson Editor saves human edits
lessonRouter.put(
  '/:id/markdown',
  validateRequest({ params: idParams, body: lessonMarkdownBody }),
  asyncHandler(async (req, res) => {
    const lesson = await lessonService.saveMarkdown(req.params.id, req.body.markdown);
    ok(res, lesson.toObject());
  }),
);

// POST /api/lessons/:id/regenerate — retry one lesson
lessonRouter.post(
  '/:id/regenerate',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const job = await generationOrchestrator.regenerateLesson(req.params.id);
    accepted(res, job);
  }),
);
