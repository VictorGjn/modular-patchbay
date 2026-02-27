export interface StreamAgentSdkParams {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
  onChunk: (text: string) => void;
  onToolUse?: (name: string, input: unknown) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export function streamAgentSdk(params: StreamAgentSdkParams): AbortController {
  const { prompt, model, systemPrompt, maxTurns, onChunk, onDone, onError } = params;

  const controller = new AbortController();

  fetch('/api/agent-sdk/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, systemPrompt, maxTurns }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Agent SDK error ${response.status}: ${body || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'text' && parsed.content) {
              onChunk(parsed.content);
            } else if (parsed.type === 'error') {
              onError(new Error(parsed.message));
              return;
            }
          } catch {
            // skip malformed
          }
        }
      }
      onDone();
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}

export interface StreamCompletionParams {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export function streamCompletion(params: StreamCompletionParams): AbortController {
  const {
    apiKey,
    baseUrl = 'https://api.openai.com/v1',
    model,
    messages,
    temperature = 0.7,
    maxTokens = 4096,
    onChunk,
    onDone,
    onError,
  } = params;

  const controller = new AbortController();

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`API error ${response.status}: ${body || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      // Stream ended without [DONE]
      onDone();
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}
