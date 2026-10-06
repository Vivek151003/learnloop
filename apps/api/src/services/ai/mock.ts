import type { LlmProvider, LlmRequest, LlmResponse } from './provider.js';

/** Deterministic provider for tests, CI and running without any API key. */
export class MockProvider implements LlmProvider {
  readonly name = 'mock' as const;

  constructor(private readonly reply: (req: LlmRequest) => string = defaultReply) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const text = this.reply(req);
    return {
      text,
      tokensIn: Math.ceil((req.system.length + req.input.length) / 4),
      tokensOut: Math.ceil(text.length / 4),
      latencyMs: 0,
      model: 'mock-1',
    };
  }
}

function defaultReply(req: LlmRequest): string {
  if (req.jsonSchema) return '{}';
  return 'Check each step again: rewrite the problem, apply one operation at a time, and verify your result.';
}
