import { aiService } from '../infrastructure/ai/index.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { contentPaths, storageService } from '../infrastructure/storage/index.js';
import { ResearchModel, TopicModel, type CourseDocument } from '../model/index.js';
import { kitPrompt, kitSystemPrompt } from './prompts/index.js';
import { productionKitJsonSchema, productionKitZ, type ProductionKit } from './kitSchemas.js';
import { renderKitMarkdown } from './markdown.js';

const log = createLogger('kit');

/**
 * Builds the production kit for a tool-test video.
 *
 * The system cannot record a presenter using a tool, which is the core of this
 * channel's format. What it can do is everything around the recording: decide
 * what to test, how to judge each test on camera, what to say, and how to
 * package the result. That is most of the work, and it is the part that
 * benefits from research.
 */

/** Titles that performed on the channel, used to anchor the voice. */
const CHANNEL_REFERENCE_TITLES = [
  'Hermes Desktop – التطبيق الجديد يلي لازم تنزّلو هلّق',
  'Grok Bot – بنيت شركة كاملة لحالي وموظفيني كلهن ذكاء اصطناعي',
  'Claude Fable 5 – بنى ١٣ موقع وأنا نايم',
  'Graphify – جرّبتها على مشروع كامل وانصدمت بالنتيجة',
  'Claude Cowork Plugins – موظفينك الجدد وصلوا',
  'LLM Wiki – وقّف تستعمل الذكاء الاصطناعي غلط',
];

export class ProductionKitService {
  async generate(course: CourseDocument, masterMarkdown: string): Promise<{
    kit: ProductionKit;
    markdownPath: string;
    jsonPath: string;
  }> {
    const topic = await TopicModel.findById(course.topicId);
    if (!topic) throw AppError.notFound('The topic behind this course no longer exists.');

    const research = await ResearchModel.findOne({ topicId: course.topicId });

    const { value } = await aiService.generateStructuredOutput({
      system: kitSystemPrompt,
      prompt: kitPrompt.build({
        toolName: topic.toolName,
        toolUrl: topic.toolUrl,
        topicTitle: topic.title,
        whatYouWillBuild: topic.whatYouWillBuild,
        measurableOutcome: topic.measurableOutcome,
        masterMarkdown,
        verifiedCommands: research?.verifiedCommands ?? [],
        channelTitles: CHANNEL_REFERENCE_TITLES,
      }),
      schemaName: 'production_kit',
      schemaDescription: 'The plan for recording a hands-on tool-test video',
      jsonSchema: productionKitJsonSchema,
      validate: (raw) => productionKitZ.parse(raw),
      temperature: 0.6,
    });

    const markdownPath = contentPaths.productionKit(course.id);
    const jsonPath = contentPaths.productionKitJson(course.id);

    await storageService.save(
      markdownPath,
      renderKitMarkdown({ kit: value, toolUrl: topic.toolUrl }),
    );
    await storageService.save(
      jsonPath,
      `${JSON.stringify({ courseId: course.id, ...value }, null, 2)}\n`,
    );

    log.info(
      `kit for course ${course.id}: ${value.tasks.length} task(s), ~${value.estimatedMinutes} min — "${value.titleEnglish}"`,
    );

    return { kit: value, markdownPath, jsonPath };
  }

  async read(courseId: string): Promise<{ markdown: string; path: string }> {
    const path = contentPaths.productionKit(courseId);
    if (!(await storageService.exists(path))) {
      throw AppError.notFound('No production kit has been generated for this course yet.');
    }
    return { markdown: await storageService.read(path), path };
  }
}

export const productionKitService = new ProductionKitService();
