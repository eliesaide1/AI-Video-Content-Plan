import { Router } from 'express';
import { asyncHandler, validateRequest } from '../middleware/index.js';
import { curriculumService } from '../application/CurriculumService.js';
import { generationOrchestrator } from '../application/GenerationOrchestrator.js';
import { sceneService } from '../application/SceneService.js';
import { storageService } from '../infrastructure/storage/index.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { accepted, ok } from './respond.js';
import { idParams, listQuery } from './validators.js';

export const courseRouter = Router();

// GET /api/courses
courseRouter.get(
  '/',
  validateRequest({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const courses = await curriculumService.list(req.query as Record<string, never>);
    ok(res, courses);
  }),
);

// GET /api/courses/:id — course + sections + lessons (Course Details screen)
courseRouter.get(
  '/:id',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const tree = await curriculumService.getCourseTree(req.params.id);
    ok(res, tree);
  }),
);

// GET /api/courses/:id/plan — COURSE.md content
courseRouter.get(
  '/:id/plan',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const course = await curriculumService.getCourse(req.params.id);
    if (!course.coursePlanPath) {
      throw AppError.badRequest('This course has no COURSE.md yet. Generate the course first.');
    }
    const markdown = await storageService.read(course.coursePlanPath);
    ok(res, { courseId: course.id, path: course.coursePlanPath, markdown });
  }),
);

// POST /api/courses/:id/generate — (re)plan the curriculum and generate lessons
courseRouter.post(
  '/:id/generate',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const job = await generationOrchestrator.startCourseGeneration(req.params.id);
    accepted(res, job);
  }),
);

// GET /api/courses/:id/scenes — the structured demo scenes
courseRouter.get(
  '/:id/scenes',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    ok(res, await sceneService.read(req.params.id));
  }),
);

// POST /api/courses/:id/scenes — generate demo scenes from the research
courseRouter.post(
  '/:id/scenes',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const job = await generationOrchestrator.startSceneGeneration(req.params.id);
    accepted(res, job);
  }),
);

// POST /api/courses/:id/teaser — generate the teaser only
courseRouter.post(
  '/:id/teaser',
  validateRequest({ params: idParams }),
  asyncHandler(async (req, res) => {
    const job = await generationOrchestrator.startTeaserGeneration(req.params.id);
    accepted(res, job);
  }),
);
