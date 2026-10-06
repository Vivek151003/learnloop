import {
  fetchWithTimeout,
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from './provider.js';

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/** A local model through Ollama: free, offline, and no data leaves the machine. */
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly maxOutputTokens: number,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const started = Date.now();
    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.input },
          ],
          ...(req.jsonSchema ? { format: req.jsonSchema } : {}),
          options: {
            num_predict: Math.min(
              req.maxOutputTokens ?? this.maxOutputTokens,
              this.maxOutputTokens,
            ),
          },
        }),
      },
      this.timeoutMs,
    );
    if (!res.ok) throw new LlmError(`Ollama returned ${res.status}`, res.status >= 500);
    const body = (await res.json()) as OllamaResponse;
    return {
      text: body.message?.content ?? '',
      tokensIn: body.prompt_eval_count ?? 0,
      tokensOut: body.eval_count ?? 0,
      latencyMs: Date.now() - started,
      model: this.model,
    };
  }
}
