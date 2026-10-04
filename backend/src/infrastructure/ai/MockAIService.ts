import { AppError } from '../errors/AppError.js';
import { createLogger } from '../logger.js';
import type { AIResult, AIService, StructuredRequest, TextRequest } from './AIService.js';

const log = createLogger('ai:mock');

/**
 * Deterministic offline provider used when AI_API_KEY is empty.
 *
 * It keeps the whole pipeline runnable (and testable) without network calls or
 * cost. Every caller supplies a `mock` factory describing the shape it expects,
 * which doubles as documentation of the contract between service and provider.
 */
export class MockAIService implements AIService {
  readonly name = 'mock';

  async generateText(request: TextRequest): Promise<AIResult<string>> {
    log.warn('using mock AI provider (set AI_API_KEY to use a real provider)');
    if (!request.mock) {
      throw AppError.internal(
        'The mock AI provider needs a `mock` factory for this text request. Set AI_API_KEY to use a real provider.',
      );
    }
    return this.result(request.mock());
  }

  async generateStructuredOutput<T>(request: StructuredRequest<T>): Promise<AIResult<T>> {
    log.warn(`using mock AI provider for "${request.schemaName}"`);
    if (!request.mock) {
      throw AppError.internal(
        `The mock AI provider needs a \`mock\` factory for "${request.schemaName}". Set AI_API_KEY to use a real provider.`,
      );
    }
    // The mock output still goes through validation, so fixtures cannot drift
    // away from the schema the real provider must satisfy.
    return this.result(request.validate(request.mock()));
  }

  private result<T>(value: T): AIResult<T> {
    return { value, model: 'mock-ai', inputTokens: 0, outputTokens: 0, durationMs: 0 };
  }
}
