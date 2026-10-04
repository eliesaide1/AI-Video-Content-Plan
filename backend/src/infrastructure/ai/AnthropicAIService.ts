import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../errors/AppError.js';
import { createLogger } from '../logger.js';
import type { AIResult, AIService, StructuredRequest, TextRequest } from './AIService.js';

const log = createLogger('ai:anthropic');

const MAX_ATTEMPTS = 3;

export class AnthropicAIService implements AIService {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly defaultMaxTokens: number,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(request: TextRequest): Promise<AIResult<string>> {
    const started = Date.now();
    const response = await this.send({
      system: request.system,
      prompt: request.prompt,
      maxTokens: request.maxTokens ?? this.defaultMaxTokens,
      temperature: request.temperature,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) {
      throw AppError.upstream('The AI provider returned an empty response.');
    }

    return this.toResult(text, response, started);
  }

  /**
   * Structured output is requested through a tool definition rather than by
   * asking for "JSON only" in the prompt: the provider then guarantees the
   * shape, and we still validate it ourselves before using it.
   */
  async generateStructuredOutput<T>(request: StructuredRequest<T>): Promise<AIResult<T>> {
    const started = Date.now();
    const response = await this.send({
      system: request.system,
      prompt: request.prompt,
      maxTokens: request.maxTokens ?? this.defaultMaxTokens,
      temperature: request.temperature,
      tool: {
        name: request.schemaName,
        description:
          request.schemaDescription ?? `Return the result as a ${request.schemaName} object.`,
        input_schema: request.jsonSchema as Anthropic.Tool.InputSchema,
      },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (!toolUse) {
      throw AppError.upstream(
        `The AI provider did not return a structured "${request.schemaName}" result.`,
      );
    }

    let value: T;
    try {
      value = request.validate(toolUse.input);
    } catch (error) {
      throw AppError.upstream(
        `The AI provider returned a "${request.schemaName}" result that failed validation.`,
        error instanceof Error ? error.message : error,
      );
    }

    return this.toResult(value, response, started);
  }

  private async send(options: {
    system?: string;
    prompt: string;
    maxTokens: number;
    temperature?: number;
    tool?: Anthropic.Tool;
  }): Promise<Anthropic.Message> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.client.messages.create({
          model: this.model,
          max_tokens: options.maxTokens,
          ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
          ...(options.system ? { system: options.system } : {}),
          ...(options.tool
            ? { tools: [options.tool], tool_choice: { type: 'tool', name: options.tool.name } }
            : {}),
          messages: [{ role: 'user', content: options.prompt }],
        });
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;
        const waitMs = 800 * 2 ** (attempt - 1);
        log.warn(`request failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${waitMs}ms`);
        await delay(waitMs);
      }
    }

    log.error('AI request failed', lastError);
    throw AppError.upstream(describeError(lastError));
  }

  private toResult<T>(value: T, response: Anthropic.Message, started: number): AIResult<T> {
    const durationMs = Date.now() - started;
    log.info(
      `${this.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens} ${durationMs}ms`,
    );
    return {
      value,
      model: this.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
    };
  }
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 408 || status === 409 || status === 429 || (typeof status === 'number' && status >= 500);
}

function describeError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return 'The AI provider rejected the API key (401). Check AI_API_KEY.';
  if (status === 429) return 'The AI provider is rate limiting us (429). Please retry in a moment.';
  if (status && status >= 500) return `The AI provider is unavailable (${status}). Please retry.`;
  const message = error instanceof Error ? error.message : 'Unknown AI provider error';
  return `AI request failed: ${message}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
