import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { AnthropicAIService } from './AnthropicAIService.js';
import { ClaudeCliAIService } from './ClaudeCliAIService.js';
import { MockAIService } from './MockAIService.js';
import type { AIService } from './AIService.js';

const log = createLogger('ai');

/**
 * Chooses the provider. Everything downstream depends only on the AIService
 * interface, so this function is the whole cost of adding or swapping one.
 *
 *   anthropic   API key, billed per token. Best structured-output guarantees;
 *               the right choice for anything deployed.
 *   claude-cli  The local Claude Code CLI, running on a Claude subscription.
 *               No API billing; local machine only.
 *   mock        Deterministic offline placeholders for plumbing tests.
 */
function createAIService(): AIService {
  switch (config.ai.provider) {
    case 'claude-cli':
      log.info(`AI provider: claude-cli (${config.ai.model}) — using your Claude subscription`);
      return new ClaudeCliAIService(config.ai.model, config.ai.cliBinary, config.ai.cliTimeoutMs);

    case 'mock':
      log.warn('AI provider: mock (placeholder content only)');
      return new MockAIService();

    case 'anthropic':
    default: {
      if (!config.ai.apiKey) {
        log.warn(
          'AI_API_KEY is not set — falling back to the mock provider. Set AI_API_KEY, or set AI_PROVIDER=claude-cli to use your Claude subscription.',
        );
        return new MockAIService();
      }
      log.info(`AI provider: anthropic (${config.ai.model})`);
      return new AnthropicAIService(config.ai.apiKey, config.ai.model, config.ai.maxOutputTokens);
    }
  }
}

export const aiService: AIService = createAIService();

/**
 * True when a provider that can actually synthesise content is configured.
 * Discovery refuses to run without one: inventing course ideas is the single
 * step a placeholder cannot fake.
 */
export const aiEnabled = aiService.name !== 'mock';

export type { AIService, AIResult, StructuredRequest, TextRequest, JsonSchema } from './AIService.js';
