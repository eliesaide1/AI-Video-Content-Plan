import { aiService } from '../infrastructure/ai/index.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { RealtimeEvent, realtime } from '../infrastructure/realtime/RealtimeGateway.js';
import { contentPaths, storageService } from '../infrastructure/storage/index.js';
import {
  CourseStatus,
  LessonModel,
  LessonStatus,
  SectionModel,
  type CourseDocument,
  type LessonDocument,
} from '../model/index.js';
import { renderLessonMarkdown } from './markdown.js';
import { systemPrompts, userPrompts } from './prompts/index.js';
import { lessonContentJsonSchema, lessonContentZ, type LessonContent } from './schemas.js';

const log = createLogger('lessons');

export interface LessonGenerationProgress {
  (completed: number, total: number, lessonTitle: string): Promise<void> | void;
}

/**
 * Generates one markdown file per lesson.
 *
 * Lessons are generated sequentially: each one is cheap on its own, failures
 * stay isolated to a single lesson (status `failed`, retryable), and we avoid
 * hammering the AI provider's rate limits.
 */
export class LessonService {
  async generateAllForCourse(
    course: CourseDocument,
    masterMarkdown: string,
    onProgress?: LessonGenerationProgress,
  ): Promise<{ generated: number; failed: number }> {
    const lessons = await LessonModel.find({ courseId: course._id }).sort({ order: 1 });
    if (!lessons.length) {
      throw AppError.badRequest('This course has no lessons planned yet.');
    }

    course.status = CourseStatus.GeneratingLessons;
    await course.save();

    const sections = await SectionModel.find({ courseId: course._id }).sort({ order: 1 }).lean();
    const sectionById = new Map(sections.map((section) => [String(section._id), section]));

    let generated = 0;
    let failed = 0;

    for (const [index, lesson] of lessons.entries()) {
      const section = sectionById.get(String(lesson.sectionId));
      try {
        await this.generateOne(course, lesson, {
          masterMarkdown,
          sectionTitle: section?.title ?? 'Section',
          sectionOrder: section?.order ?? 1,
          previousLessonTitle: lessons[index - 1]?.title,
          nextLessonTitle: lessons[index + 1]?.title,
        });
        generated += 1;
      } catch (error) {
        failed += 1;
        log.error(`lesson ${lesson.id} failed`, error);
      }
      await onProgress?.(index + 1, lessons.length, lesson.title);
    }

    course.status = failed === lessons.length ? CourseStatus.Failed : CourseStatus.Ready;
    course.error = failed ? `${failed} lesson(s) failed to generate` : null;
    await course.save();
    realtime.emit(RealtimeEvent.CourseUpdated, { courseId: course.id, status: course.status });

    log.info(`course ${course.id}: ${generated} lesson(s) generated, ${failed} failed`);
    return { generated, failed };
  }

  async generateOne(
    course: CourseDocument,
    lesson: LessonDocument,
    context: {
      masterMarkdown: string;
      sectionTitle: string;
      sectionOrder: number;
      previousLessonTitle?: string;
      nextLessonTitle?: string;
    },
  ): Promise<LessonDocument> {
    lesson.status = LessonStatus.Generating;
    lesson.error = null;
    await lesson.save();

    try {
      const { value } = await aiService.generateStructuredOutput({
        system: systemPrompts.lesson,
        prompt: userPrompts.lesson({
          courseTitle: course.title,
          sectionTitle: context.sectionTitle,
          lessonTitle: lesson.title,
          learningObjective: lesson.learningObjective,
          concepts: [],
          estimatedDuration: lesson.estimatedDuration,
          previousLessonTitle: context.previousLessonTitle,
          nextLessonTitle: context.nextLessonTitle,
          masterExcerpt: context.masterMarkdown,
          context: { audience: course.targetAudience, depth: course.desiredDepth },
        }),
        schemaName: 'lesson_content',
        schemaDescription: 'The structured content of one lesson',
        jsonSchema: lessonContentJsonSchema,
        validate: (raw) => lessonContentZ.parse(raw),
        temperature: 0.5,
        mock: () => mockLesson(lesson.title),
      });

      const markdownPath = contentPaths.lesson(
        course.id,
        context.sectionOrder,
        lesson.orderInSection,
      );

      await storageService.save(
        markdownPath,
        renderLessonMarkdown({
          courseTitle: course.title,
          sectionTitle: context.sectionTitle,
          sectionOrder: context.sectionOrder,
          lessonOrder: lesson.order,
          estimatedDuration: lesson.estimatedDuration,
          content: value,
        }),
      );

      lesson.markdownPath = markdownPath;
      lesson.learningObjective = value.learningObjective || lesson.learningObjective;
      lesson.status = LessonStatus.Generated;
      await lesson.save();

      realtime.emit(RealtimeEvent.LessonUpdated, {
        courseId: course.id,
        lessonId: lesson.id,
        status: lesson.status,
      });
      return lesson;
    } catch (error) {
      lesson.status = LessonStatus.Failed;
      lesson.error = error instanceof Error ? error.message : String(error);
      await lesson.save();
      realtime.emit(RealtimeEvent.LessonUpdated, {
        courseId: course.id,
        lessonId: lesson.id,
        status: lesson.status,
      });
      throw error;
    }
  }

  async getById(id: string): Promise<LessonDocument> {
    const lesson = await LessonModel.findById(id);
    if (!lesson) throw AppError.notFound(`Lesson ${id} was not found.`);
    return lesson;
  }

  /** Lesson Editor: read the generated markdown. */
  async readMarkdown(id: string): Promise<{ lesson: LessonDocument; markdown: string }> {
    const lesson = await this.getById(id);
    if (!lesson.markdownPath) {
      throw AppError.badRequest('This lesson has not been generated yet.');
    }
    return { lesson, markdown: await storageService.read(lesson.markdownPath) };
  }

  /** Lesson Editor: save human edits back to disk. */
  async saveMarkdown(id: string, markdown: string): Promise<LessonDocument> {
    const lesson = await this.getById(id);
    if (!lesson.markdownPath) {
      throw AppError.badRequest('This lesson has not been generated yet.');
    }
    if (typeof markdown !== 'string' || !markdown.trim()) {
      throw AppError.badRequest('Lesson markdown cannot be empty.');
    }

    await storageService.save(lesson.markdownPath, markdown);
    lesson.status = LessonStatus.Edited;
    await lesson.save();

    realtime.emit(RealtimeEvent.LessonUpdated, {
      courseId: String(lesson.courseId),
      lessonId: lesson.id,
      status: lesson.status,
    });
    return lesson;
  }
}

export const lessonService = new LessonService();

/** Offline fixture. */
function mockLesson(title: string): LessonContent {
  return lessonContentZ.parse({
    title,
    learningObjective: `Understand ${title}.`,
    concepts: ['Placeholder concept'],
    instructorExplanation: `Mock lesson content for "${title}". Set AI_API_KEY to generate real lessons.`,
    examples: [{ name: 'Example', explanation: 'Placeholder example.' }],
    demonstration: '',
    code: [],
    visualSuggestions: ['Simple title slide'],
    commonMistakes: [],
    summary: 'Placeholder summary.',
    studentExercise: '',
    nextLessonTransition: '',
  });
}
