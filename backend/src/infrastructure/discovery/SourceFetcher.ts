import { XMLParser } from 'fast-xml-parser';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('discovery:sources');

/** A normalised item retrieved from a real source, before any AI involvement. */
export interface SourceItem {
  title: string;
  url: string;
  summary: string;
  origin: string;
  kind: 'release' | 'article';
  publishedAt?: Date;
  retrievedAt: Date;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Retrieves real information from real sources (GitHub releases + RSS/Atom
 * feeds), then normalises and deduplicates it.
 *
 * This exists because the spec is explicit: we must NOT just ask an LLM "what
 * is trending?". The LLM only gets to classify and rank what we actually
 * fetched.
 */
export class SourceFetcher {
  async fetchAll(): Promise<SourceItem[]> {
    const tasks: Promise<SourceItem[]>[] = [
      ...config.discovery.githubRepos.map((repo) => this.fetchGithubReleases(repo)),
      ...config.discovery.rssFeeds.map((feed) => this.fetchFeed(feed)),
    ];

    const settled = await Promise.allSettled(tasks);
    const items = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const failed = settled.filter((result) => result.status === 'rejected').length;

    if (failed) log.warn(`${failed}/${settled.length} source(s) failed; continuing with the rest`);

    const deduped = dedupe(items).sort(byPublishedAtDesc);
    log.info(`retrieved ${items.length} item(s), ${deduped.length} after dedupe`);
    return deduped;
  }

  private async fetchGithubReleases(repo: string): Promise<SourceItem[]> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ai-content-course-factory',
    };
    if (config.discovery.githubToken) {
      headers.Authorization = `Bearer ${config.discovery.githubToken}`;
    }

    const response = await this.request(
      `https://api.github.com/repos/${repo}/releases?per_page=5`,
      headers,
    );
    const releases = (await response.json()) as GithubRelease[];
    const retrievedAt = new Date();

    return releases
      .filter((release) => !release.draft)
      .map((release) => ({
        title: `${repo} ${release.name || release.tag_name}`,
        url: release.html_url,
        summary: clean(release.body ?? '').slice(0, 1200),
        origin: `github:${repo}`,
        kind: 'release' as const,
        publishedAt: release.published_at ? new Date(release.published_at) : undefined,
        retrievedAt,
      }));
  }

  private async fetchFeed(feedUrl: string): Promise<SourceItem[]> {
    const response = await this.request(feedUrl, {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent': 'ai-content-course-factory',
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
      kind: 'article' as const,
      publishedAt: toDate(text(item.pubDate)),
      retrievedAt,
    }));

    const atomItems = toArray(parsed?.feed?.entry).map((entry) => ({
      title: clean(text(entry.title)),
      url: entryLink(entry),
      summary: clean(text(entry.summary) || text(entry.content)).slice(0, 1200),
      origin,
      kind: 'article' as const,
      publishedAt: toDate(text(entry.updated) || text(entry.published)),
      retrievedAt,
    }));

    return [...rssItems, ...atomItems].filter((item) => item.title && item.url);
  }

  private async request(url: string, headers: Record<string, string>): Promise<Response> {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`${url} responded ${response.status}`);
    }
    return response;
  }
}

export const sourceFetcher = new SourceFetcher();

/* ----------------------------- helpers ----------------------------- */

function dedupe(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  const result: SourceItem[] = [];
  for (const item of items) {
    const key = `${item.url}|${item.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function byPublishedAtDesc(a: SourceItem, b: SourceItem): number {
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

/* ----------------------------- shapes ----------------------------- */

interface GithubRelease {
  name?: string;
  tag_name: string;
  html_url: string;
  body?: string;
  draft?: boolean;
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
