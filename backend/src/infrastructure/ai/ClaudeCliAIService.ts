import { spawn } from 'node:child_process';
import os from 'node:os';
import { AppError } from '../errors/AppError.js';
import { createLogger } from '../logger.js';
import type { AIResult, AIService, StructuredRequest, TextRequest } from './AIService.js';

const log = createLogger('ai:claude-cli');

/**
 * Runs generation through the local Claude Code CLI (`claude -p`) instead of
 * the Anthropic API.
 *
 * Why this exists: a Claude Max subscription covers the CLI but not API
 * billing. This provider lets the pipeline run on a subscription the user
 * already pays for.
 *
 * Known trade-offs, deliberately accepted:
 *  - The machine running the backend needs the CLI installed and logged in, so
 *    this is a local-development provider. Deployments should use the API.
 *  - Each call spawns a process (~2-3s overhead) and consumes subscription
 *    rate limits rather than per-token billing.
 *  - There is no provider-enforced tool schema, so structured output is
 *    requested in the prompt and then validated here, with one corrective
 *    retry. The Zod validators are the same ones the API provider uses, so a
 *    malformed response can never reach the rest of the application.
 */
export class ClaudeCliAIService implements AIService {
  readonly name = 'claude-cli';

  constructor(
    private readonly model: string,
    private readonly binary: string,
    private readonly timeoutMs: number,
  ) {}

  async generateText(request: TextRequest): Promise<AIResult<string>> {
    const started = Date.now();
    const { text, costUsd } = await this.run(request.prompt, request.system);
    return this.toResult(text, started, costUsd);
  }

  async generateStructuredOutput<T>(request: StructuredRequest<T>): Promise<AIResult<T>> {
    const started = Date.now();
    const instruction = buildJsonInstruction(request);

    let lastError = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const prompt =
        attempt === 1
          ? instruction
          : `${instruction}\n\nYour previous reply could not be used: ${lastError}\nReturn ONLY the corrected JSON object, with no commentary and no code fences.`;

      const { text, costUsd } = await this.run(prompt, request.system);

      try {
        const parsed = extractJson(text);
        const value = request.validate(parsed);
        return this.toResult(value, started, costUsd);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        log.warn(
          `"${request.schemaName}" response failed validation on attempt ${attempt}: ${lastError.slice(0, 300)}`,
        );
      }
    }

    throw AppError.upstream(
      `The Claude CLI did not return a valid "${request.schemaName}" object after two attempts.`,
      lastError,
    );
  }

  private run(prompt: string, system?: string): Promise<{ text: string; costUsd: number }> {
    return new Promise((resolve, reject) => {
      const args = [
        '--print',
        '--output-format',
        'json',
        '--model',
        this.model,
        '--max-turns',
        '1',
        '--no-session-persistence',
        // This is a text-generation call, not an agent session. Tools must be
        // REMOVED, not merely denied: with them present the model spends its
        // single turn attempting a tool call and the run dies with
        // `error_max_turns` before it ever answers.
        '--tools',
        '',
      ];

      if (system) args.push('--system-prompt', system);

      const child = spawn(this.binary, args, {
        // Run outside the repo so no CLAUDE.md or project context leaks into
        // the generation prompt.
        cwd: os.tmpdir(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(
          AppError.upstream(
            `The Claude CLI did not respond within ${Math.round(this.timeoutMs / 1000)}s.`,
          ),
        );
      }, this.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(
          AppError.upstream(
            `Could not start the Claude CLI ("${this.binary}"). Is Claude Code installed and on PATH?`,
            error.message,
          ),
        );
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        // The CLI reports its real reason in the JSON payload even when it
        // exits non-zero, so parse stdout BEFORE falling back to the exit
        // code — otherwise every failure reads as a useless "exited with 1".
        const payload = tryParse(stdout);

        if (!payload) {
          reject(
            AppError.upstream(
              code === 0
                ? 'The Claude CLI returned output that was not JSON.'
                : describeFailure(code, stderr),
              stdout.slice(0, 500) || stderr.slice(0, 500),
            ),
          );
          return;
        }

        if (payload.is_error || !payload.result) {
          reject(AppError.upstream(describePayloadError(payload), payload.result?.slice(0, 500)));
          return;
        }

        resolve({ text: payload.result, costUsd: payload.total_cost_usd ?? 0 });
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private toResult<T>(value: T, started: number, costUsd: number): AIResult<T> {
    const durationMs = Date.now() - started;
    // Cost is reported for visibility; on a subscription it is drawn from the
    // plan's limits rather than billed per token.
    log.info(`${this.model} ${durationMs}ms (plan usage ≈ $${costUsd.toFixed(4)})`);
    return { value, model: `${this.model} (claude-cli)`, inputTokens: 0, outputTokens: 0, durationMs };
  }
}

/* ----------------------------- helpers ----------------------------- */

function buildJsonInstruction<T>(request: StructuredRequest<T>): string {
  return `${request.prompt}

----
OUTPUT FORMAT (strict)
${request.schemaDescription ?? `Return a ${request.schemaName} object.`}

Reply with ONE JSON object that validates against this JSON Schema:

${JSON.stringify(request.jsonSchema, null, 2)}

Rules:
- Output the JSON object and nothing else: no prose before or after, no code fences.
- Include every required property. Use "" or [] for fields that do not apply.
- Do not add properties that are not in the schema.`;
}

/**
 * Pulls the JSON object out of a reply, tolerating code fences or a stray
 * sentence around it. Scans with string/escape awareness so a brace inside a
 * string value cannot end the object early.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to brace scanning
  }

  const start = trimmed.indexOf('{');
  if (start === -1) throw new Error('the reply contained no JSON object');

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(start, index + 1));
      }
    }
  }

  throw new Error('the reply contained an unterminated JSON object');
}

function tryParse(stdout: string): CliPayload | null {
  try {
    const payload = JSON.parse(stdout) as CliPayload;
    return typeof payload === 'object' && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

function describePayloadError(payload: CliPayload): string {
  if (payload.subtype === 'error_max_turns') {
    return 'The Claude CLI ran out of turns before answering (it tried to use a tool). This is a bug in how the CLI is invoked, not in your plan.';
  }
  if (payload.subtype === 'error_during_execution') {
    return 'The Claude CLI failed while generating. Retrying usually clears it.';
  }
  const errors = payload.errors?.join(' ') ?? '';
  if (/rate limit|usage limit|quota/i.test(errors)) {
    return 'Your Claude plan has hit its usage limit. Wait for the reset, or switch AI_PROVIDER to anthropic with an API key.';
  }
  if (payload.api_error_status) {
    return `The Claude CLI reported an error (${payload.api_error_status}). ${errors}`.trim();
  }
  return `The Claude CLI returned an error. ${errors}`.trim();
}

function describeFailure(code: number | null, stderr: string): string {
  const detail = stderr.trim().split('\n').slice(-3).join(' ').slice(0, 300);

  if (/rate limit|usage limit|quota/i.test(stderr)) {
    return 'Your Claude plan has hit its usage limit. Wait for the limit to reset, or switch AI_PROVIDER to anthropic with an API key.';
  }
  if (/not logged in|unauthorized|authentication/i.test(stderr)) {
    return 'The Claude CLI is not logged in. Run `claude` once in a terminal and sign in.';
  }
  return `The Claude CLI exited with code ${code}. ${detail}`;
}

interface CliPayload {
  is_error?: boolean;
  result?: string;
  total_cost_usd?: number;
  api_error_status?: string | number;
  subtype?: string;
  errors?: string[];
}
