// The LLM boundary. Only this folder talks to a model provider (SRS section 3).
// Week 3 builds question generation, explanations and hints on top of it.

export interface LlmRequest {
  /** Fixed instructions. User text never goes here (AI-21). */
  system: string;
  /** User-supplied content, passed as data. */
  input: string;
  /** Ask for JSON output matching this JSON Schema (AI-1). */
  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
}

export interface LlmResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
}

export interface LlmProvider {
  readonly name: 'gemini' | 'ollama' | 'mock';
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/** Every call has a hard timeout (AI-5). */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    throw new LlmError(timedOut ? 'LLM call timed out' : 'LLM provider unreachable', true);
  }
}
