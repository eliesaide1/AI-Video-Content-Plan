import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Single place where process.env is read.
 * Everything else in the app receives typed values from here, so we never
 * sprinkle `process.env.X` (and never leak a key into a response payload).
 */
function str(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function num(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(name: string, fallback: string[] = []): string[] {
  const raw = str(name);
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  env: str('NODE_ENV', 'development'),
  port: num('PORT', 4000),
  corsOrigin: list('CORS_ORIGIN', ['http://localhost:5173', 'http://localhost:3000']),

  mongoUri: str('MONGODB_URI', 'mongodb://127.0.0.1:27017/ai_content_factory'),

  ai: {
    /** 'anthropic' (API key) | 'claude-cli' (local Claude subscription) | 'mock' */
    provider: str('AI_PROVIDER', 'anthropic'),
    apiKey: str('AI_API_KEY'),
    model: str('AI_MODEL', 'claude-sonnet-5'),
    maxOutputTokens: num('AI_MAX_OUTPUT_TOKENS', 16000),
    /** claude-cli only: the executable and how long one generation may take. */
    cliBinary: str('AI_CLI_BINARY', 'claude'),
    cliTimeoutMs: num('AI_CLI_TIMEOUT_MS', 300_000),
  },

  storage: {
    generatedRoot: path.resolve(process.cwd(), str('GENERATED_ROOT', './generated')),
  },

  discovery: {
    /** Engineering blogs / "how we built X" writing — the richest signal. */
    rssFeeds: list('DISCOVERY_RSS_FEEDS', [
      'https://openai.com/blog/rss.xml',
      'https://github.blog/engineering.atom',
    ]),
    /** Repos we follow for MAJOR releases only (patch/canary noise is dropped). */
    githubRepos: list('DISCOVERY_GITHUB_REPOS', []),
    /** Subjects used to query trending repos and community tutorials. */
    trendingTopics: list('DISCOVERY_TRENDING_TOPICS', [
      'ai-agents',
      'llm',
      'typescript',
      'react',
      'devops',
    ]),
    /** Minimum Hacker News points for a story to count as a signal. */
    hackerNewsMinPoints: num('DISCOVERY_HN_MIN_POINTS', 150),
    maxCandidates: num('DISCOVERY_MAX_CANDIDATES', 20),
    githubToken: str('GITHUB_TOKEN'),
  },
} as const;

export const isProduction = config.env === 'production';
