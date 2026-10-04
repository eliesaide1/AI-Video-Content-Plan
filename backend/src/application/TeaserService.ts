import { aiService } from '../infrastructure/ai/index.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { RealtimeEvent, realtime } from '../infrastructure/realtime/RealtimeGateway.js';
import { contentPaths, storageService } from '../infrastructure/storage/index.js';
import { TeaserModel, TeaserStatus, type CourseDocument, type TeaserDocument } from '../model/index.js';
import { renderTeaserMarkdown } from './markdown.js';
import { systemPrompts, userPrompts } from './prompts/index.js';
import { teaserJsonSchema, teaserScriptZ, type TeaserScript } from './schemas.js';

const log = createLogger('teaser');

/**
 * Teaser generator: a 15-30s promotional script per course.
 *
 * Writes teaser.md (human-editable) and teaser.json (the structured beats).
 * Phase 2 turns those beats into scenes; nothing here needs to change for that.
 */
export class TeaserService {
  async generate(course: CourseDocument, masterMarkdown: string): Promise<TeaserDocument> {
    const teaser = await this.upsertGenerating(course);

    try {
      const { value: script } = await aiService.generateStructuredOutput({
        system: systemPrompts.teaser,
        prompt: userPrompts.teaser({
          courseTitle: course.title,
          courseDescription: course.description,
          learningObjectives: course.learningObjectives,
          context: { audience: course.targetAudience, depth: course.desiredDepth },
          masterExcerpt: masterMarkdown.slice(0, 8000),
        }),
        schemaName: 'teaser_script',
        schemaDescription: 'A 15-30 second teaser script broken into beats',
        jsonSchema: teaserJsonSchema,
        validate: (raw) => teaserScriptZ.parse(raw),
        temperature: 0.7,
        mock: () => mockTeaser(course.title),
      });

      const markdownPath = contentPaths.teaserMarkdown(course.id);
      const jsonPath = contentPaths.teaserJson(course.id);

      await storageService.save(
        markdownPath,
        renderTeaserMarkdown({
          courseTitle: course.title,
          level: course.level,
          audience: course.targetAudience,
          script,
        }),
      );

      await storageService.save(
        jsonPath,
        `${JSON.stringify({ courseId: course.id, ...script }, null, 2)}\n`,
      );

      teaser.set({
        hook: script.hook,
        callToAction: script.callToAction,
        duration: script.durationSeconds,
        beats: script.beats,
        markdownPath,
        scenesPath: jsonPath,
        status: TeaserStatus.Generated,
        error: null,
      });
      await teaser.save();

      log.info(`teaser generated for course ${course.id} (${script.durationSeconds}s)`);
      realtime.emit(RealtimeEvent.TeaserUpdated, {
        courseId: course.id,
        teaserId: teaser.id,
        status: teaser.status,
      });
      return teaser;
    } catch (error) {
      teaser.status = TeaserStatus.Failed;
      teaser.error = error instanceof Error ? error.message : String(error);
      await teaser.save();
      throw error;
    }
  }

  async getByCourseId(courseId: string): Promise<TeaserDocument> {
    const teaser = await TeaserModel.findOne({ courseId });
    if (!teaser) throw AppError.notFound('No teaser exists for this course yet.');
    return teaser;
  }

  async readMarkdown(courseId: string): Promise<{ teaser: TeaserDocument; markdown: string }> {
    const teaser = await this.getByCourseId(courseId);
    if (!teaser.markdownPath) {
      throw AppError.badRequest('This teaser has not been generated yet.');
    }
    return { teaser, markdown: await storageService.read(teaser.markdownPath) };
  }

  async list(limit = 50) {
    return TeaserModel.find().sort({ updatedAt: -1 }).limit(Math.min(limit, 200)).lean();
  }

  private async upsertGenerating(course: CourseDocument): Promise<TeaserDocument> {
    const existing = await TeaserModel.findOne({ courseId: course._id });
    if (existing) {
      existing.status = TeaserStatus.Generating;
      existing.error = null;
      await existing.save();
      return existing;
    }
    return TeaserModel.create({ courseId: course._id, status: TeaserStatus.Generating });
  }
}

export const teaserService = new TeaserService();

/** Offline fixture. */
function mockTeaser(courseTitle: string): TeaserScript {
  return teaserScriptZ.parse({
    hook: `Ever wondered how ${courseTitle} actually works?`,
    durationSeconds: 25,
    callToAction: 'Watch the full course to build it yourself.',
    beats: [
      {
        label: 'hook',
        startSecond: 0,
        endSecond: 3,
        narration: `Ever wondered how ${courseTitle} actually works?`,
        onScreenText: 'How does it work?',
      },
      {
        label: 'problem',
        startSecond: 3,
        endSecond: 8,
        narration: 'Most tutorials stop at the surface.',
        onScreenText: 'Surface level only',
      },
      {
        label: 'idea',
        startSecond: 8,
        endSecond: 18,
        narration: 'We go one level deeper and build it from scratch.',
        onScreenText: 'Build it from scratch',
      },
      {
        label: 'outcome',
        startSecond: 18,
        endSecond: 22,
        narration: 'By the end you will have a working project.',
        onScreenText: 'A working project',
      },
      {
        label: 'call-to-action',
        startSecond: 22,
        endSecond: 25,
        narration: 'Watch the full course to build it yourself.',
        onScreenText: 'Start the course',
      },
    ],
  });
}
