import { aiService } from '../infrastructure/ai/index.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { contentPaths, storageService } from '../infrastructure/storage/index.js';
import { TopicModel, type CourseDocument } from '../model/index.js';
import { demoPrompt, systemPrompts } from './prompts/index.js';
import {
  clampToLimits,
  demoScriptJsonSchema,
  demoScriptZ,
  type DemoScript,
} from './sceneSchemas.js';

const log = createLogger('scenes');

/**
 * Turns MASTER.md into structured scenes the renderer can draw (spec §9).
 *
 * This is the step that lets a video SHOW rather than assert: scenes carry the
 * real commands, output, code and numbers, so the Remotion components have
 * actual material to put on screen.
 */
export class SceneService {
  async generateDemo(course: CourseDocument, masterMarkdown: string): Promise<{
    script: DemoScript;
    path: string;
    totalSeconds: number;
  }> {
    const topic = await TopicModel.findById(course.topicId);
    if (!topic) throw AppError.notFound('The topic behind this course no longer exists.');

    const { value } = await aiService.generateStructuredOutput({
      system: systemPrompts.demo,
      prompt: demoPrompt.build({
        toolName: topic.toolName,
        topicTitle: topic.title,
        whatYouWillBuild: topic.whatYouWillBuild,
        measurableOutcome: topic.measurableOutcome,
        courseTitle: course.title,
        masterMarkdown,
        context: { audience: course.targetAudience, depth: course.desiredDepth },
      }),
      schemaName: 'demo_scenes',
      schemaDescription: 'Scenes that show the problem and the fix, with real commands',
      jsonSchema: demoScriptJsonSchema,
      validate: (raw) => demoScriptZ.parse(normalise(raw)),
      temperature: 0.4,
    });

    const totalSeconds = value.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
    const path = contentPaths.demoScenes(course.id);

    await storageService.save(
      path,
      `${JSON.stringify({ courseId: course.id, totalSeconds, ...value }, null, 2)}\n`,
    );

    log.info(
      `demo scenes for course ${course.id}: ${value.scenes.length} scene(s), ${totalSeconds}s ` +
        `(${value.scenes.map((scene) => scene.type).join(' → ')})`,
    );

    return { script: value, path, totalSeconds };
  }

  async read(courseId: string): Promise<unknown> {
    const path = contentPaths.demoScenes(courseId);
    if (!(await storageService.exists(path))) {
      throw AppError.notFound('No demo scenes have been generated for this course yet.');
    }
    return JSON.parse(await storageService.read(path));
  }
}

/**
 * The provider returns one flat object per scene (its tool schema cannot
 * express a discriminated union), so fields belonging to other scene types
 * arrive as empty strings. Strip them before Zod sees them, or a `title`
 * scene carrying `before: {label:'', ...}` fails validation.
 */
function normalise(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const payload = raw as { scenes?: unknown[] };
  if (!Array.isArray(payload.scenes)) return raw;

  const keep: Record<string, string[]> = {
    title: ['type', 'durationSeconds', 'narration', 'headline', 'subhead', 'chips'],
    problem: ['type', 'durationSeconds', 'narration', 'headline', 'painSteps', 'costLabel', 'costValue'],
    terminal: ['type', 'durationSeconds', 'narration', 'title', 'lines'],
    code: ['type', 'durationSeconds', 'narration', 'filename', 'language', 'code', 'highlightLines'],
    comparison: ['type', 'durationSeconds', 'narration', 'headline', 'before', 'after'],
    outcome: ['type', 'durationSeconds', 'narration', 'headline', 'bullets'],
    cta: ['type', 'durationSeconds', 'narration', 'headline', 'courseTitle'],
  };

  return {
    ...payload,
    scenes: payload.scenes.map((scene) => {
      if (typeof scene !== 'object' || scene === null) return scene;
      const typed = scene as Record<string, unknown>;
      const allowed = keep[String(typed.type)];
      if (!allowed) return scene;
      const picked = Object.fromEntries(
        Object.entries(typed).filter(([key, value]) => allowed.includes(key) && value !== ''),
      );
      // Trim anything that overshoots the display limits rather than failing.
      return clampToLimits(picked);
    }),
  };
}

export const sceneService = new SceneService();
