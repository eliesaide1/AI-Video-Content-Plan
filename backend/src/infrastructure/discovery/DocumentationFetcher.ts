import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('discovery:docs');

export interface ToolDocumentation {
  toolName: string;
  sourceUrl: string;
  /** The documentation text, trimmed to something a prompt can carry. */
  text: string;
  /** Commands lifted verbatim from fenced shell blocks. */
  commands: string[];
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_DOC_CHARS = 18_000;

/** Fence languages whose contents are shell commands. */
const SHELL_LANGUAGES = new Set(['', 'bash', 'sh', 'shell', 'console', 'zsh', 'terminal']);
const COMMAND_START =
  /^(\$\s*)?(npm|npx|pnpm|yarn|bun|pip3?|python3?|node|go|cargo|brew|apt|docker|git|curl|wget|make|uvx?|poetry|deno|claude|codex|gh|ollama|export|cd|mkdir|\.\/)\b/i;

/**
 * Fetches a tool's own documentation.
 *
 * Why this exists: research previously worked from link titles plus model
 * memory, so when a demo needed a command the model produced something
 * plausible — "codex run --task validate_invoice.task" — that does not exist.
 * A viewer types that and it fails. Commands have to come from the tool's own
 * README or docs page, verbatim.
 */
export class DocumentationFetcher {
  async fetchForTool(toolName: string, toolUrl: string): Promise<ToolDocumentation | null> {
    if (!toolUrl) return null;

    try {
      const text = toolUrl.includes('github.com')
        ? await this.fetchGithubReadme(toolUrl)
        : await this.fetchPage(toolUrl);

      if (!text) return null;

      const commands = extractCommands(text);
      log.info(
        `${toolName}: ${text.length} chars of docs, ${commands.length} command(s) found at ${toolUrl}`,
      );

      return {
        toolName,
        sourceUrl: toolUrl,
        text: text.slice(0, MAX_DOC_CHARS),
        commands,
      };
    } catch (error) {
      // Missing docs degrade the demo, they do not break the pipeline.
      log.warn(`could not fetch docs for ${toolName} (${toolUrl}): ${String(error)}`);
      return null;
    }
  }

  private async fetchGithubReadme(repoUrl: string): Promise<string> {
    const match = /github\.com\/([^/]+)\/([^/#?]+)/.exec(repoUrl);
    if (!match) return '';
    const [, owner, repo] = match;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
      'User-Agent': 'ai-content-course-factory',
    };
    if (config.discovery.githubToken) {
      headers.Authorization = `Bearer ${config.discovery.githubToken}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, '')}/readme`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!response.ok) throw new Error(`readme responded ${response.status}`);
    return response.text();
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ai-content-course-factory', Accept: 'text/html,text/plain' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`page responded ${response.status}`);
    const html = await response.text();

    // Keep <pre>/<code> contents intact — that is where the commands live —
    // then strip the rest of the markup.
    const codeBlocks = [...html.matchAll(/<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi)]
      .map((match) => decode(stripTags(match[1])))
      .filter((block) => block.trim().length > 2)
      .map((block) => `\`\`\`\n${block.trim()}\n\`\`\``)
      .join('\n\n');

    const prose = decode(
      stripTags(
        html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' '),
      ),
    )
      .replace(/\s+/g, ' ')
      .trim();

    return `${prose.slice(0, MAX_DOC_CHARS / 2)}\n\n${codeBlocks}`;
  }
}

/* ----------------------------- helpers ----------------------------- */

/**
 * Pulls command lines out of fenced shell blocks, verbatim.
 *
 * Scans line by line rather than matching fences with a regex. A pattern that
 * treats ``` as both opener and closer mis-pairs on any README that mixes
 * plain and language-tagged fences — on Firecrawl's it paired an HTML
 * <details> block with a bash fence's closing marker and found nothing in a
 * file containing eighteen bash blocks.
 *
 * Shell continuations (`\` at end of line) are joined, so a multi-line curl
 * comes back as the one command a viewer would paste.
 */
export function extractCommands(markdown: string): string[] {
  const commands: string[] = [];
  const seen = new Set<string>();

  let inFence = false;
  let isShell = false;
  let pending = '';

  const flush = () => {
    const command = pending.replace(/^\$\s*/, '').trim();
    pending = '';
    if (command.length < 3 || command.length > 300) return;
    if (seen.has(command)) return;
    seen.add(command);
    commands.push(command);
  };

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();

    if (line.trimStart().startsWith('```')) {
      if (pending) flush();
      if (inFence) {
        inFence = false;
        isShell = false;
      } else {
        inFence = true;
        isShell = SHELL_LANGUAGES.has(line.trim().slice(3).trim().toLowerCase());
      }
      continue;
    }

    if (!inFence || !isShell) continue;

    const trimmed = line.trim();

    // Mid-command continuation.
    if (pending) {
      pending += ` ${trimmed.replace(/\\$/, '').trim()}`;
      if (!trimmed.endsWith('\\')) flush();
      if (commands.length >= 40) return commands;
      continue;
    }

    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!COMMAND_START.test(trimmed)) continue;

    if (trimmed.endsWith('\\')) {
      pending = trimmed.replace(/\\$/, '').trim();
    } else {
      pending = trimmed;
      flush();
    }

    if (commands.length >= 40) return commands;
  }

  if (pending) flush();
  return commands;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ');
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export const documentationFetcher = new DocumentationFetcher();
