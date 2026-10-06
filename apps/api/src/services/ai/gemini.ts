import {
  fetchWithTimeout,
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from './provider.js';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * Google Gemini through its REST API (free tier from Google AI Studio). The key
 * goes in a header, never in the URL, so it cannot end up in access logs (AI-23).
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    private readonly maxOutputTokens: number,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const started = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.input }] }],
          generationConfig: {
            maxOutputTokens: Math.min(
              req.maxOutputTokens ?? this.maxOutputTokens,
              this.maxOutputTokens,
            ),
            ...(req.jsonSchema
              ? { responseMimeType: 'application/json', responseJsonSchema: req.jsonSchema }
              : {}),
          },
        }),
      },
      this.timeoutMs,
    );
    if (!res.ok) {
      throw new LlmError(`Gemini returned ${res.status}`, res.status === 429 || res.status >= 500);
    }
    const body = (await res.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return {
      text,
      tokensIn: body.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: body.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
      model: this.model,
    };
  }
}
