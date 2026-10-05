import { config } from '../infrastructure/config.js';
import { aiEnabled, aiService } from '../infrastructure/ai/index.js';
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
  /** Proposals the quality gate threw away, with the reason. Never silent. */
  rejected: { title: string; reason: string }[];
  topicIds: string[];
}

/**
 * Content discovery:
 *   real sources -> retrieve -> normalise -> deduplicate -> AI synthesis
 *   -> quality gate -> candidate topics
 *
 * Two rules shape this service:
 *
 *  1. The AI never invents what is trending. It only works from signals we
 *     actually retrieved.
 *  2. A signal is evidence, not a topic. The AI's job is to propose something a
 *     student can BUILD because of the signal. The quality gate below enforces
 *     that in code, so a changelog can never reach the dashboard as a course
 *     idea even if the model slips.
 */
export class DiscoveryService {
  async run(options: { maxCandidates?: number } = {}): Promise<DiscoveryRunResult> {
    const runId = `run-${Date.now().toString(36)}`;
    const maxCandidates = Math.min(options.maxCandidates ?? config.discovery.maxCandidates, 30);

    // Discovery is pure synthesis: turning signals into buildable course ideas
    // is the one step a placeholder provider cannot fake. Echoing retrieved
    // headlines back as "topics" produces changelog-shaped junk, so we refuse
    // instead. (Research/lessons still run on the mock for plumbing tests.)
    if (!aiEnabled) {
      throw new AppError(
        'Discovery needs a real AI provider to turn sources into course ideas. Set AI_API_KEY in backend/.env, or add topics manually on this screen.',
        { statusCode: 400, code: 'AI_PROVIDER_REQUIRED', expose: true },
      );
    }

    log.info(`discovery ${runId} started (max ${maxCandidates} candidates)`);

    const items = await sourceFetcher.fetchAll();
    if (!items.length) {
      throw AppError.upstream(
        'No sources could be retrieved. Check DISCOVERY_RSS_FEEDS / DISCOVERY_GITHUB_REPOS and your network connection.',
      );
    }

    const alreadyCovered = await topicService.alreadyCoveredTitles();
    // A balanced mix, not just the top of one source: a blog archive would
    // otherwise crowd out the tutorials and trending projects, which are the
    // signals that most often point at something buildable.
    const considered = balancedSelection(items, 60);

    const { value } = await aiService.generateStructuredOutput({
      system: systemPrompts.discovery,
      prompt: userPrompts.rankTopics({
        items: considered.map((item) => ({
          title: item.title,
          url: item.url,
          summary: item.summary,
          origin: item.origin,
          kind: item.kind,
          publishedAt: item.publishedAt,
        })),
        alreadyCovered,
        maxCandidates,
      }),
      schemaName: 'candidate_topics',
      schemaDescription: 'Candidate course topics ranked from the retrieved source items',
      jsonSchema: rankedTopicsJsonSchema,
      validate: (raw) => rankedTopicsZ.parse(raw),
      temperature: 0.4,
    });

    const { accepted, rejected } = applyQualityGate(value.topics, considered);
    const proposed = accepted.slice(0, maxCandidates);

    // Never drop proposals silently — a run that rejects everything must be
    // visible, not look like a run that found nothing.
    rejected.forEach((entry) => log.info(`rejected "${entry.title}" — ${entry.reason}`));

    const result = await this.persistCandidates(proposed, considered, runId, rejected);

    const fullShape = proposed.filter(
      (topic) => topic.toolName && topic.isFreeOrOpenSource && topic.measurableOutcome,
    ).length;
    log.info(
      `discovery ${runId} done: ${result.created} created (${fullShape} with a free tool AND a measurable result), ` +
        `${result.skippedAsDuplicate} duplicate(s), ${rejected.length} rejected by the quality gate`,
    );
    realtime.emit(RealtimeEvent.DiscoveryCompleted, result);
    return result;
  }

  private async persistCandidates(
    proposed: RankedTopic[],
    items: SourceItem[],
    runId: string,
    rejected: { title: string; reason: string }[],
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
        whatYouWillBuild: candidate.whatYouWillBuild,
        toolName: candidate.toolName,
        toolUrl: candidate.toolUrl,
        isFreeOrOpenSource: candidate.isFreeOrOpenSource,
        measurableOutcome: candidate.measurableOutcome,
        credibilityAnchor: candidate.credibilityAnchor,
        whoBenefits: candidate.whoBenefits,
        whyNow: candidate.whyNow,
        prerequisites: candidate.prerequisites,
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
      rejected,
      topicIds,
    };
  }
}

/**
 * Round-robins across signal kinds so every kind is represented, then fills any
 * remaining room with the highest-value leftovers.
 */
function balancedSelection(items: SourceItem[], limit: number): SourceItem[] {
  const buckets = new Map<string, SourceItem[]>();
  for (const item of items) {
    const bucket = buckets.get(item.kind);
    if (bucket) bucket.push(item);
    else buckets.set(item.kind, [item]);
  }

  const queues = [...buckets.values()];
  const selected: SourceItem[] = [];
  let index = 0;

  while (selected.length < limit && queues.some((queue) => queue.length)) {
    const queue = queues[index % queues.length];
    const next = queue.shift();
    if (next) selected.push(next);
    index += 1;
  }

  return selected;
}

/* ------------------------------ quality gate ------------------------------
 * The prompt asks for buildable topics; this enforces it. Anything shaped like
 * a release note, a company announcement or a vague theme is thrown out before
 * it can reach a human for approval.
 * ------------------------------------------------------------------------ */

/**
 * Version-shaped titles: "X v2.1.3", "v16.4.0-canary.59", "release 4.0".
 *
 * Deliberately NOT a bare `\d+\.\d+` — that rejected "Run a 2.78-trillion-
 * parameter LLM on nothing but your CPU", where the decimal is a quantity, not
 * a version. A version needs a `v` prefix, three components, or a
 * pre-release word.
 */
const VERSION_SHAPED =
  /\bv\d+\.\d+|\b\d+\.\d+\.\d+\b|canary|nightly|\balpha\b|\bbeta\b|\brc\d/i;
/** Titles that announce rather than teach. */
const ANNOUNCEMENT = /^(what'?s new|release notes?|changelog|introducing|announcing|.+ releases? .+)/i;
/** "owner/repo ..." — a repository name is not a course title. */
const REPO_SHAPED = /^[\w.-]+\/[\w.-]+(\s|$)/;
/**
 * Titles that promise understanding rather than a result.
 *
 * This replaced an allow-list of "building" verbs, which was the wrong shape:
 * every run turned up a legitimate verb the list lacked ("run", "host", then
 * "edit"), and each miss threw away a good topic. Naming the small, closed set
 * of non-action phrasings is both more precise and stable.
 */
const NON_ACTION = [
  /^(understanding|introduction to|intro to|an? (brief )?(guide|overview|primer|introduction)|the basics of|basics of|fundamentals of|what is|what are|why .+ matters?|the future of|the state of|everything you need to know|deep dive into|exploring|a look at|thoughts on|notes on)\b/i,
  /\b(explained|demystified|in a nutshell|101)\s*$/i,
];

export function applyQualityGate(
  candidates: RankedTopic[],
  items: SourceItem[],
): { accepted: RankedTopic[]; rejected: { title: string; reason: string }[] } {
  const signalTitles = new Set(items.map((item) => item.title.trim().toLowerCase()));
  const accepted: RankedTopic[] = [];
  const rejected: { title: string; reason: string }[] = [];

  for (const candidate of candidates) {
    const title = candidate.title.trim();
    const reason = rejectionReason(title, candidate, signalTitles);
    if (reason) rejected.push({ title, reason });
    else accepted.push(candidate);
  }

  return { accepted, rejected };
}

function rejectionReason(
  title: string,
  candidate: RankedTopic,
  signalTitles: Set<string>,
): string | null {
  if (signalTitles.has(title.toLowerCase())) {
    return 'the title is a source headline copied verbatim, not a course topic';
  }
  if (VERSION_SHAPED.test(title)) return 'the title contains a version number or pre-release tag';
  if (ANNOUNCEMENT.test(title)) return 'the title announces a release rather than teaching something';
  if (REPO_SHAPED.test(title)) return 'the title is a repository name';
  if (NON_ACTION.some((pattern) => pattern.test(title))) {
    return 'the title promises understanding rather than a result the viewer reaches';
  }
  if (!candidate.whatYouWillBuild.trim()) {
    return 'no concrete deliverable — the student would finish with nothing to show';
  }
  if (candidate.score < 40) return `score ${candidate.score} is below the teachability floor of 40`;
  return null;
}

export const discoveryService = new DiscoveryService();
