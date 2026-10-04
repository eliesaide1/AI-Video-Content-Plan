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
    provider: str('AI_PROVIDER', 'anthropic'),
    apiKey: str('AI_API_KEY'),
    model: str('AI_MODEL', 'claude-sonnet-5'),
    maxOutputTokens: num('AI_MAX_OUTPUT_TOKENS', 16000),
  },

  storage: {
    generatedRoot: path.resolve(process.cwd(), str('GENERATED_ROOT', './generated')),
  },

  discovery: {
    rssFeeds: list('DISCOVERY_RSS_FEEDS', [
      'https://openai.com/blog/rss.xml',
      'https://github.blog/engineering.atom',
    ]),
    githubRepos: list('DISCOVERY_GITHUB_REPOS', [
      'anthropics/claude-code',
      'modelcontextprotocol/servers',
    ]),
    maxCandidates: num('DISCOVERY_MAX_CANDIDATES', 20),
    githubToken: str('GITHUB_TOKEN'),
  },
} as const;

export const isProduction = config.env === 'production';
