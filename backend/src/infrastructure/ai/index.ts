import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { AnthropicAIService } from './AnthropicAIService.js';
import { MockAIService } from './MockAIService.js';
import type { AIService } from './AIService.js';

const log = createLogger('ai');

function createAIService(): AIService {
  if (!config.ai.apiKey) {
    log.warn('AI_API_KEY is not set — falling back to the mock AI provider');
    return new MockAIService();
  }

  switch (config.ai.provider) {
    case 'anthropic':
      log.info(`AI provider: anthropic (${config.ai.model})`);
      return new AnthropicAIService(config.ai.apiKey, config.ai.model, config.ai.maxOutputTokens);
    case 'mock':
      return new MockAIService();
    default:
      log.warn(`unknown AI_PROVIDER "${config.ai.provider}" — using anthropic`);
      return new AnthropicAIService(config.ai.apiKey, config.ai.model, config.ai.maxOutputTokens);
  }
}

export const aiService: AIService = createAIService();
export const aiEnabled = Boolean(config.ai.apiKey);

export type { AIService, AIResult, StructuredRequest, TextRequest, JsonSchema } from './AIService.js';
