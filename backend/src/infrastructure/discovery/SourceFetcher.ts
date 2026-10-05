import { XMLParser } from 'fast-xml-parser';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('discovery:sources');

/**
 * A normalised SIGNAL retrieved from a real source.
 *
 * A signal is evidence that something is worth teaching — it is NOT a course
 * topic. "next.js released v16.4.0-canary.59" is a signal; "Add streaming
 * server components to an existing Next.js app" is the topic a human would pay
 * to learn. Turning signals into topics is the AI's job in DiscoveryService.
 */
export interface SourceItem {
  title: string;
  url: string;
  summary: string;
  origin: string;
  kind: SignalKind;
  /** Rough popularity (HN points, GitHub stars, article reactions). */
  weight: number;
  publishedAt?: Date;
  retrievedAt: Date;
}

export type SignalKind =
  /**
   * A newly released free/open-source tool someone can install today.
   * The strongest signal we have: "here is a free tool, I ran it on a real
   * project, here is the result" is the format that actually gets watched.
   */
  | 'new-tool'
  /** Someone launching their own tool (Show HN) — a new-tool signal with an audience reaction attached. */
  | 'tool-launch'
  /** "How we built X" engineering writing. */
  | 'engineering-article'
  /** A community tutorial people actually read. */
  | 'tutorial'
  /** An established repo gaining traction. */
  | 'trending-project'
  /** A story developers are discussing right now. */
  | 'discussion'
  /** A significant stable release (patch/canary noise is dropped). */
  | 'release';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const FETCH_TIMEOUT_MS = 12_000;
const UA = 'ai-content-course-factory';
/** Some feeds serve their whole archive; only the newest entries are signals. */
const MAX_ITEMS_PER_FEED = 12;

/** Releases that are pure noise for teaching purposes. */
const PRERELEASE = /canary|alpha|beta|nightly|-rc[.\-]?\d|\brc\d|preview|snapshot/i;
/** A body that is just a list of issue references teaches nothing. */
const ISSUE_REF = /#\d+/g;

export class SourceFetcher {
  async fetchAll(): Promise<SourceItem[]> {
    const tasks: Promise<SourceItem[]>[] = [
      this.fetchNewTools(),
      this.fetchShowHN(),
      this.fetchHackerNews(),
      this.fetchDevToTutorials(),
      this.fetchTrendingRepositories(),
      ...config.discovery.rssFeeds.map((feed) => this.fetchFeed(feed)),
      ...config.discovery.githubRepos.map((repo) => this.fetchMajorReleases(repo)),
    ];

    const settled = await Promise.allSettled(tasks);
    const items = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    settled
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .forEach((result) => log.warn(`a source failed: ${String(result.reason)}`));

    const deduped = dedupe(items).sort(byValue);

    const byKind = deduped.reduce<Record<string, number>>((counts, item) => {
      counts[item.kind] = (counts[item.kind] ?? 0) + 1;
      return counts;
    }, {});
    log.info(
      `retrieved ${items.length} signal(s), ${deduped.length} after dedupe — ${JSON.stringify(byKind)}`,
    );

    return deduped;
  }

  /**
   * What developers are actually discussing. One request via the Algolia HN
   * API, filtered by score so we only see things with real traction.
   */
  private async fetchHackerNews(): Promise<SourceItem[]> {
    const minPoints = config.discovery.hackerNewsMinPoints;
    const response = await this.request(
      `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>${minPoints}&hitsPerPage=40`,
    );
    const payload = (await response.json()) as { hits: HackerNewsHit[] };
    const retrievedAt = new Date();

    return payload.hits
      .filter((hit) => hit.url && hit.title)
      .filter((hit) => !isJobOrMetaPost(hit.title))
      // Show HN is fetched separately as a tool-launch signal.
      .filter((hit) => !/^show hn/i.test(hit.title.trim()))
      .map((hit) => ({
        title: clean(hit.title),
        url: hit.url as string,
        summary: `Discussed on Hacker News with ${hit.points} points and ${hit.num_comments ?? 0} comments.`,
        origin: `hn:${safeHost(hit.url as string)}`,
        kind: 'discussion' as const,
        weight: hit.points ?? 0,
        publishedAt: hit.created_at ? new Date(hit.created_at) : undefined,
        retrievedAt,
      }));
  }

  /**
   * Newly created repositories gaining stars fast.
   *
   * This is the signal that finds tools like Graphify: small, new, free, and
   * spreading. The established-repo query cannot find them — it surfaces
   * microsoft/vscode. Here the star bar is low and the age window is short, so
   * what comes back is "a tool that did not exist last quarter".
   */
  private async fetchNewTools(): Promise<SourceItem[]> {
    const createdAfter = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)
      .toISOString()
      .slice(0, 10);
    const topics = config.discovery.trendingTopics.slice(0, 4);

    const requests = topics.map(async (topic) => {
      const query = `topic:${topic} created:>${createdAfter} stars:>${config.discovery.newToolMinStars}`;
      const response = await this.request(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=8`,
        this.githubHeaders(),
      );
      const payload = (await response.json()) as { items?: GithubRepo[] };
      const retrievedAt = new Date();

      return (payload.items ?? [])
        .filter((repo) => repo.description)
        .map((repo) => ({
          title: `${repo.name ?? repo.full_name} — ${clean(repo.description ?? '')}`,
          url: repo.html_url,
          summary:
            `NEW free tool: ${clean(repo.description ?? '')}. ` +
            `${repo.stargazers_count} stars in under 90 days, written in ${repo.language ?? 'unknown'}. ` +
            `License: ${repo.license?.spdx_id ?? 'unspecified'}. Install from ${repo.html_url}`,
          origin: `github-new:${topic}`,
          kind: 'new-tool' as const,
          weight: 100 + Math.round((repo.stargazers_count ?? 0) / 50),
          publishedAt: repo.created_at ? new Date(repo.created_at) : undefined,
          retrievedAt,
        }));
    });

    const settled = await Promise.allSettled(requests);
    return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }

  /**
   * Show HN: developers launching their own tools, with the community's
   * reaction attached. A high-scoring Show HN is a tool people found genuinely
   * useful on the day it appeared.
   */
  private async fetchShowHN(): Promise<SourceItem[]> {
    const response = await this.request(
      'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=points>60&hitsPerPage=30',
    );
    const payload = (await response.json()) as { hits: HackerNewsHit[] };
    const retrievedAt = new Date();

    return payload.hits
      .filter((hit) => hit.url && hit.title)
      .map((hit) => ({
        title: clean(hit.title).replace(/^show hn:\s*/i, ''),
        url: hit.url as string,
        summary: `A tool its author launched publicly. ${hit.points} points and ${hit.num_comments ?? 0} comments on Hacker News, so people engaged with it.`,
        origin: `show-hn:${safeHost(hit.url as string)}`,
        kind: 'tool-launch' as const,
        weight: 80 + (hit.points ?? 0),
        publishedAt: hit.created_at ? new Date(hit.created_at) : undefined,
        retrievedAt,
      }));
  }

  /**
   * Community tutorials. These show what people WANT taught, and are
   * step-by-step by nature — exactly the shape our courses should take.
   */
  private async fetchDevToTutorials(): Promise<SourceItem[]> {
    const tags = config.discovery.trendingTopics.slice(0, 4);
    const requests = tags.map(async (tag) => {
      const response = await this.request(
        `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=14&per_page=8`,
      );
      const articles = (await response.json()) as DevToArticle[];
      const retrievedAt = new Date();

      return articles.map((article) => ({
        title: clean(article.title),
        url: article.url,
        summary: clean(article.description ?? '').slice(0, 800),
        origin: `dev.to:${tag}`,
        kind: 'tutorial' as const,
        weight: article.positive_reactions_count ?? 0,
        publishedAt: article.published_at ? new Date(article.published_at) : undefined,
        retrievedAt,
      }));
    });

    const settled = await Promise.allSettled(requests);
    return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }

  /**
   * Repos gaining traction in our subject areas. A tool people are adopting is
   * something students benefit from learning to use and build with.
   */
  private async fetchTrendingRepositories(): Promise<SourceItem[]> {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString().slice(0, 10);
    const topics = config.discovery.trendingTopics.slice(0, 3);

    const requests = topics.map(async (topic) => {
      const query = `topic:${topic} pushed:>${since} stars:>300`;
      const response = await this.request(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=6`,
        this.githubHeaders(),
      );
      const payload = (await response.json()) as { items?: GithubRepo[] };
      const retrievedAt = new Date();

      return (payload.items ?? [])
        .filter((repo) => repo.description)
        .map((repo) => ({
          title: `${repo.full_name} — ${clean(repo.description ?? '')}`,
          url: repo.html_url,
          summary: `${clean(repo.description ?? '')} (${repo.stargazers_count} stars, ${repo.language ?? 'unknown language'})`,
          origin: `github-trending:${topic}`,
          kind: 'trending-project' as const,
          weight: Math.round((repo.stargazers_count ?? 0) / 100),
          publishedAt: repo.pushed_at ? new Date(repo.pushed_at) : undefined,
          retrievedAt,
        }));
    });

    const settled = await Promise.allSettled(requests);
    return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }

  /**
   * Stable, substantive releases only.
   *
   * Pre-releases and changelog-only bodies are dropped: "fixed a deny rule on a
   * nested part of a compound shell command" is not something anyone can build
   * a course around, and letting it through is what produced topics like
   * "anthropics/claude-code v2.1.289".
   */
  private async fetchMajorReleases(repo: string): Promise<SourceItem[]> {
    const response = await this.request(
      `https://api.github.com/repos/${repo}/releases?per_page=10`,
      this.githubHeaders(),
    );
    const releases = (await response.json()) as GithubRelease[];
    const retrievedAt = new Date();

    const substantive = releases
      .filter((release) => !release.draft && !release.prerelease)
      .filter((release) => !PRERELEASE.test(release.tag_name) && !PRERELEASE.test(release.name ?? ''))
      .filter((release) => hasTeachableBody(release.body ?? ''))
      // One release per repo: ten consecutive patch notes are not ten topics.
      .slice(0, 1);

    return substantive.map((release) => ({
      title: `${repo} ${release.name || release.tag_name}`,
      url: release.html_url,
      summary: clean(release.body ?? '').slice(0, 1200),
      origin: `github-release:${repo}`,
      kind: 'release' as const,
      weight: 5,
      publishedAt: release.published_at ? new Date(release.published_at) : undefined,
      retrievedAt,
    }));
  }

  private async fetchFeed(feedUrl: string): Promise<SourceItem[]> {
    const response = await this.request(feedUrl, {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
    });
    const xml = await response.text();
    const parsed = parser.parse(xml) as FeedDocument;
    const retrievedAt = new Date();
    const origin = safeHost(feedUrl);

    const rssItems = toArray(parsed?.rss?.channel?.item).map((item) => ({
      title: clean(text(item.title)),
      url: text(item.link),
      summary: clean(text(item.description) || text(item['content:encoded'])).slice(0, 1200),
      origin,
      kind: 'engineering-article' as const,
      weight: 20,
      publishedAt: toDate(text(item.pubDate)),
      retrievedAt,
    }));

    const atomItems = toArray(parsed?.feed?.entry).map((entry) => ({
      title: clean(text(entry.title)),
      url: entryLink(entry),
      summary: clean(text(entry.summary) || text(entry.content)).slice(0, 1200),
      origin,
      kind: 'engineering-article' as const,
      weight: 20,
      publishedAt: toDate(text(entry.updated) || text(entry.published)),
      retrievedAt,
    }));

    return [...rssItems, ...atomItems]
      .filter((item) => item.title && item.url)
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      .slice(0, MAX_ITEMS_PER_FEED);
  }

  private githubHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (config.discovery.githubToken) {
      headers.Authorization = `Bearer ${config.discovery.githubToken}`;
    }
    return headers;
  }

  private async request(url: string, headers: Record<string, string> = {}): Promise<Response> {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, ...headers },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${safeHost(url)} responded ${response.status}`);
    return response;
  }
}

export const sourceFetcher = new SourceFetcher();

/* ----------------------------- helpers ----------------------------- */

/** A release body made of issue links and one-line fixes teaches nothing. */
function hasTeachableBody(body: string): boolean {
  const prose = clean(body).replace(ISSUE_REF, '').trim();
  if (prose.length < 400) return false;
  const issueRefs = (body.match(ISSUE_REF) ?? []).length;
  // More than one issue reference per 120 characters of prose = a changelog.
  return issueRefs < prose.length / 120;
}

function isJobOrMetaPost(title: string): boolean {
  return /^(ask hn|tell hn|show hn: my|hiring|who is hiring|launch hn)/i.test(title.trim());
}

function dedupe(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  const result: SourceItem[] = [];
  for (const item of items) {
    const key = `${normaliseUrl(item.url)}|${item.title.toLowerCase().slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * Installable tools rank above commentary: the topic shape we want is "here is
 * a free tool, here is it running on a real project, here is the result".
 */
const KIND_PRIORITY: Record<SignalKind, number> = {
  'new-tool': 7,
  'tool-launch': 6,
  'engineering-article': 5,
  tutorial: 4,
  'trending-project': 3,
  discussion: 2,
  release: 1,
};

function byValue(a: SourceItem, b: SourceItem): number {
  const kind = KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind];
  if (kind !== 0) return kind;
  if (b.weight !== a.weight) return b.weight - a.weight;
  return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
}

function clean(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)['#text'] ?? '');
  }
  return '';
}

function entryLink(entry: AtomEntry): string {
  const link = entry.link;
  if (Array.isArray(link)) {
    const alternate = link.find((candidate) => candidate['@_rel'] !== 'self') ?? link[0];
    return alternate?.['@_href'] ?? '';
  }
  if (link && typeof link === 'object') return link['@_href'] ?? '';
  return text(link);
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/* ----------------------------- shapes ----------------------------- */

interface HackerNewsHit {
  title: string;
  url: string | null;
  points?: number;
  num_comments?: number;
  created_at?: string;
}

interface DevToArticle {
  title: string;
  url: string;
  description?: string;
  published_at?: string;
  positive_reactions_count?: number;
}

interface GithubRepo {
  name?: string;
  full_name: string;
  html_url: string;
  description?: string | null;
  stargazers_count?: number;
  language?: string | null;
  pushed_at?: string;
  created_at?: string;
  license?: { spdx_id?: string } | null;
}

interface GithubRelease {
  name?: string;
  tag_name: string;
  html_url: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string;
}

interface AtomLink {
  '@_href'?: string;
  '@_rel'?: string;
}

interface AtomEntry {
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  updated?: unknown;
  published?: unknown;
  link?: AtomLink | AtomLink[] | string;
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  description?: unknown;
  'content:encoded'?: unknown;
  pubDate?: unknown;
}

interface FeedDocument {
  rss?: { channel?: { item?: RssItem | RssItem[] } };
  feed?: { entry?: AtomEntry | AtomEntry[] };
}
