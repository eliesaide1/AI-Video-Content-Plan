import { config } from '../infrastructure/config.js';
import { aiService } from '../infrastructure/ai/index.js';
import { sourceFetcher, type SourceItem } from '../infrastructure/discovery/SourceFetcher.js';
import { AppError } from '../infrastructure/errors/AppError.js';
import { createLogger } from '../infrastructure/logger.js';
import { RealtimeEvent, realtime } from '../infrastructure/realtime/RealtimeGateway.js';
import {
  TopicModel,
  TopicStatus,
  buildDedupeKey,
  type Audience,
  type CourseDepth,
} from '../model/index.js';
import { systemPrompts, userPrompts } from './prompts/index.js';
import { rankedTopicsJsonSchema, rankedTopicsZ, type RankedTopic } from './schemas.js';
import { topicService } from './TopicService.js';

const log = createLogger('discovery');

export interface DiscoveryRunResult {
  runId: string;
  retrievedItems: number;
  proposed: number;
  created: number;
  skippedAsDuplicate: number;
  topicIds: string[];
}

/**
 * Content discovery: Sources -> retrieve -> normalise -> deduplicate ->
 * AI classification -> AI ranking -> candidate topics.
 *
 * The AI never invents what is trending: it only classifies and ranks items we
 * actually retrieved from real sources.
 */
export class DiscoveryService {
  async run(options: { maxCandidates?: number } = {}): Promise<DiscoveryRunResult> {
    const runId = `run-${Date.now().toString(36)}`;
    const maxCandidates = Math.min(options.maxCandidates ?? config.discovery.maxCandidates, 30);

    log.info(`discovery ${runId} started (max ${maxCandidates} candidates)`);

    const items = await sourceFetcher.fetchAll();
    if (!items.length) {
      throw AppError.upstream(
        'No sources could be retrieved. Check DISCOVERY_RSS_FEEDS / DISCOVERY_GITHUB_REPOS and your network connection.',
      );
    }

    const alreadyCovered = await topicService.alreadyCoveredTitles();
    const considered = items.slice(0, 60);

    const { value } = await aiService.generateStructuredOutput({
      system: systemPrompts.discovery,
      prompt: userPrompts.rankTopics({ items: considered, alreadyCovered, maxCandidates }),
      schemaName: 'candidate_topics',
      schemaDescription: 'Candidate course topics ranked from the retrieved source items',
      jsonSchema: rankedTopicsJsonSchema,
      validate: (raw) => rankedTopicsZ.parse(raw),
      temperature: 0.4,
      mock: () => mockRanking(considered, maxCandidates),
    });

    const proposed = value.topics.slice(0, maxCandidates);
    const result = await this.persistCandidates(proposed, considered, runId);

    log.info(
      `discovery ${runId} done: ${result.created} created, ${result.skippedAsDuplicate} duplicates`,
    );
    realtime.emit(RealtimeEvent.DiscoveryCompleted, result);
    return result;
  }

  private async persistCandidates(
    proposed: RankedTopic[],
    items: SourceItem[],
    runId: string,
  ): Promise<DiscoveryRunResult> {
    const byUrl = new Map(items.map((item) => [item.url, item]));
    const topicIds: string[] = [];
    let created = 0;
    let skipped = 0;

    for (const candidate of proposed) {
      const dedupeKey = buildDedupeKey(candidate.title);
      const existing = await TopicModel.findOne({ dedupeKey }).select('_id');
      if (existing) {
        skipped += 1;
        continue;
      }

      const sources = candidate.sourceUrls
        .map((url) => byUrl.get(url))
        .filter((item): item is SourceItem => Boolean(item))
        .map((item) => ({
          title: item.title,
          url: item.url,
          origin: item.origin,
          publishedAt: item.publishedAt,
          retrievedAt: item.retrievedAt,
        }));

      const topic = await TopicModel.create({
        title: candidate.title.trim(),
        dedupeKey,
        description: candidate.description,
        category: candidate.category,
        audience: candidate.suggestedAudience as Audience,
        desiredDepth: candidate.suggestedDepth as CourseDepth,
        score: Math.round(candidate.score),
        rankingReasons: candidate.rankingReasons,
        sources,
        status: TopicStatus.Candidate,
        discoveryRunId: runId,
        discoveredAt: new Date(),
      });

      topicIds.push(topic.id);
      created += 1;
    }

    return {
      runId,
      retrievedItems: items.length,
      proposed: proposed.length,
      created,
      skippedAsDuplicate: skipped,
      topicIds,
    };
  }
}

export const discoveryService = new DiscoveryService();

/** Offline fixture: ranks retrieved items by recency so the flow still works. */
function mockRanking(items: SourceItem[], maxCandidates: number) {
  const topics = items.slice(0, Math.max(1, Math.min(maxCandidates, 10))).map((item, index) => ({
    title: item.title.slice(0, 180),
    description:
      item.summary.slice(0, 500) ||
      'Retrieved from a real source. Mock AI provider produced this placeholder ranking.',
    category: item.kind === 'release' ? 'releases' : 'engineering',
    score: Math.max(40, 95 - index * 4),
    rankingReasons: [
      'Recently published by a reputable source',
      'Mock provider ranking — enable AI_API_KEY for real scoring',
    ],
    sourceUrls: [item.url],
    suggestedAudience: 'intermediate-developers' as const,
    suggestedDepth: 'medium' as const,
  }));

  return { topics };
}
