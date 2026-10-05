import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { RealtimeEvent, realtime } from '../infrastructure/realtime/RealtimeGateway.js';
import {
  Audience,
  CourseDepth,
  CourseModel,
  TopicModel,
  TopicStatus,
  buildDedupeKey,
  type TopicDocument,
} from '../model/index.js';

const log = createLogger('topics');

export interface CreateTopicInput {
  title: string;
  description?: string;
  whatYouWillBuild?: string;
  /** Naming the tool lets ResearchService fetch its real documentation. */
  toolName?: string;
  toolUrl?: string;
  category?: string;
  audience?: Audience;
  desiredDepth?: CourseDepth;
  sources?: { title: string; url: string; origin?: string }[];
}

export interface ListTopicsOptions {
  status?: string;
  audience?: string;
  search?: string;
  limit?: number;
}

/**
 * Topic lifecycle: manual entry, listing for the Discover screen, and the human
 * approval step that gates every expensive downstream operation.
 */
export class TopicService {
  async create(input: CreateTopicInput): Promise<TopicDocument> {
    const title = input.title.trim();
    const dedupeKey = buildDedupeKey(title);

    const existing = await TopicModel.findOne({ dedupeKey });
    if (existing) {
      throw AppError.conflict('This topic already exists.', { topicId: existing.id });
    }

    const topic = await TopicModel.create({
      title,
      dedupeKey,
      description: input.description?.trim() ?? '',
      whatYouWillBuild: input.whatYouWillBuild?.trim() ?? '',
      toolName: input.toolName?.trim() ?? '',
      toolUrl: input.toolUrl?.trim() ?? '',
      isFreeOrOpenSource: Boolean(input.toolUrl),
      category: input.category?.trim() || 'general',
      audience: input.audience ?? Audience.Intermediate,
      desiredDepth: input.desiredDepth ?? CourseDepth.Medium,
      // A manually entered topic is pre-approved: the human already chose it.
      status: TopicStatus.Approved,
      score: 0,
      rankingReasons: ['Manually entered by a human'],
      sources: input.sources ?? [],
      discoveredAt: new Date(),
    });

    log.info(`topic created: ${topic.id} "${topic.title}"`);
    realtime.emit(RealtimeEvent.TopicUpdated, { topicId: topic.id, status: topic.status });
    return topic;
  }

  async list(options: ListTopicsOptions = {}) {
    const query: Record<string, unknown> = {};
    if (options.status) query.status = options.status;
    if (options.audience) query.audience = options.audience;
    // Uses the topic_text_search index.
    if (options.search) query.$text = { $search: options.search };

    return TopicModel.find(query)
      .sort(options.search ? { score: -1 } : { status: 1, score: -1 })
      .limit(Math.min(options.limit ?? 50, 200))
      .lean();
  }

  async getById(id: string): Promise<TopicDocument> {
    const topic = await TopicModel.findById(id);
    if (!topic) throw AppError.notFound(`Topic ${id} was not found.`);
    return topic;
  }

  /** Human approval — the gate before any expensive generation. */
  async approve(
    id: string,
    overrides: { audience?: Audience; desiredDepth?: CourseDepth } = {},
  ): Promise<TopicDocument> {
    const topic = await this.getById(id);
    if (topic.status === TopicStatus.CourseGenerated) {
      throw AppError.conflict('This topic already produced a course.');
    }

    if (overrides.audience) topic.audience = overrides.audience;
    if (overrides.desiredDepth) topic.desiredDepth = overrides.desiredDepth;
    topic.status = TopicStatus.Approved;
    topic.rejectedReason = null;
    await topic.save();

    log.info(`topic approved: ${topic.id}`);
    realtime.emit(RealtimeEvent.TopicUpdated, { topicId: topic.id, status: topic.status });
    return topic;
  }

  async reject(id: string, reason?: string): Promise<TopicDocument> {
    const topic = await this.getById(id);
    topic.status = TopicStatus.Rejected;
    topic.rejectedReason = reason?.trim() || null;
    await topic.save();
    realtime.emit(RealtimeEvent.TopicUpdated, { topicId: topic.id, status: topic.status });
    return topic;
  }

  async setStatus(topic: TopicDocument, status: TopicStatus): Promise<void> {
    topic.status = status;
    await topic.save();
    realtime.emit(RealtimeEvent.TopicUpdated, { topicId: topic.id, status });
  }

  /**
   * Titles of everything we already covered or already proposed. Discovery uses
   * this so the same topic is not suggested twice.
   */
  async alreadyCoveredTitles(limit = 120): Promise<string[]> {
    const [topics, courses] = await Promise.all([
      TopicModel.find({ status: { $ne: TopicStatus.Rejected } })
        .select('title')
        .sort({ discoveredAt: -1 })
        .limit(limit)
        .lean(),
      CourseModel.find().select('title').sort({ createdAt: -1 }).limit(limit).lean(),
    ]);

    return [...new Set([...topics.map((t) => t.title), ...courses.map((c) => c.title)])];
  }
}

export const topicService = new TopicService();
