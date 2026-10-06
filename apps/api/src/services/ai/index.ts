import { config } from '../../config.js';
import { GeminiProvider } from './gemini.js';
import { MockProvider } from './mock.js';
import { OllamaProvider } from './ollama.js';
import type { LlmProvider } from './provider.js';

export function createLlmProvider(): LlmProvider {
  switch (config.AI_PROVIDER) {
    case 'gemini':
      return new GeminiProvider(
        config.GEMINI_API_KEY!,
        config.GEMINI_MODEL,
        config.AI_TIMEOUT_MS,
        config.AI_MAX_OUTPUT_TOKENS,
      );
    case 'ollama':
      return new OllamaProvider(
        config.OLLAMA_URL,
        config.OLLAMA_MODEL,
        config.AI_TIMEOUT_MS,
        config.AI_MAX_OUTPUT_TOKENS,
      );
    default:
      return new MockProvider();
  }
}

export type { LlmProvider, LlmRequest, LlmResponse } from './provider.js';
