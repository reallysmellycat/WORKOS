import type { AISettings } from './settings';
import type { ChatMessage } from './types';

/**
 * Provider-independent AI layer.
 *
 * The app never ships with an API key and works fully without AI. A provider
 * is only used when you configure one in Settings → AI. To add a provider,
 * implement `AIProvider` and register it in `createProvider`.
 *
 * Privacy: requests go directly from your browser to the endpoint you
 * configure. Only the context you explicitly select in the assistant is sent.
 */
export interface ChatOptions {
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
  temperature?: number;
}

export interface AIProvider {
  id: AISettings['provider'];
  label: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  listModels(): Promise<string[]>;
}

export class AIError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.hint = hint;
  }
}

const trimSlash = (s: string) => s.replace(/\/+$/, '');

async function guardFetch(url: string, init: RequestInit, provider: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AIError(
      `Could not reach ${provider} at ${url}.`,
      provider === 'Ollama'
        ? 'Check Ollama is running (open the Ollama app, or run "ollama serve"). If Work OS is hosted online, Ollama must allow this site: set OLLAMA_ORIGINS to this site\'s address and restart Ollama.'
        : 'Check the base URL, your internet connection, and that the provider allows requests from a browser (CORS).',
    );
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    const hint =
      res.status === 401 || res.status === 403
        ? 'The API key was rejected. Check it in Settings → AI.'
        : res.status === 404
          ? 'Model or endpoint not found. Check the model name (for Ollama, run "ollama pull <model>" first).'
          : res.status === 429
            ? 'Rate limit reached — free tiers have limits. Wait a little and try again.'
            : undefined;
    throw new AIError(`${provider} returned an error (${res.status}). ${detail}`, hint);
  }
  return res;
}

async function readLines(res: Response, onLine: (line: string) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onLine(line);
    }
  }
  if (buf.trim()) onLine(buf.trim());
}

/** Ollama — free, runs models locally on your own computer. https://ollama.com */
class OllamaProvider implements AIProvider {
  id = 'ollama' as const;
  label = 'Ollama (local)';
  constructor(private s: AISettings) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}) {
    const res = await guardFetch(
      `${trimSlash(this.s.baseUrl)}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.s.model, messages, stream: true, options: { temperature: opts.temperature ?? this.s.temperature } }),
        signal: opts.signal,
      },
      'Ollama',
    );
    let out = '';
    await readLines(res, (line) => {
      try {
        const j = JSON.parse(line);
        const t = j.message?.content ?? '';
        if (t) {
          out += t;
          opts.onToken?.(t);
        }
        if (j.error) throw new AIError(j.error);
      } catch (e) {
        if (e instanceof AIError) throw e;
      }
    });
    return out;
  }

  async listModels() {
    const res = await guardFetch(`${trimSlash(this.s.baseUrl)}/api/tags`, {}, 'Ollama');
    const j = await res.json();
    return (j.models ?? []).map((m: { name: string }) => m.name);
  }
}

/**
 * Any OpenAI-compatible endpoint: LM Studio (local, free), llama.cpp server,
 * Groq / OpenRouter / Google AI Studio free tiers, etc.
 */
class OpenAICompatibleProvider implements AIProvider {
  id = 'openai' as const;
  label = 'OpenAI-compatible';
  constructor(private s: AISettings) {}

  private headers() {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.s.apiKey) h.Authorization = `Bearer ${this.s.apiKey}`;
    return h;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}) {
    const res = await guardFetch(
      `${trimSlash(this.s.baseUrl)}/chat/completions`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ model: this.s.model, messages, stream: true, temperature: opts.temperature ?? this.s.temperature }),
        signal: opts.signal,
      },
      'The AI provider',
    );
    let out = '';
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('event-stream')) {
      const j = await res.json();
      out = j.choices?.[0]?.message?.content ?? '';
      opts.onToken?.(out);
      return out;
    }
    await readLines(res, (line) => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const t = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
        if (t) {
          out += t;
          opts.onToken?.(t);
        }
      } catch {
        /* partial line */
      }
    });
    return out;
  }

  async listModels() {
    const res = await guardFetch(`${trimSlash(this.s.baseUrl)}/models`, { headers: this.headers() }, 'The AI provider');
    const j = await res.json();
    return (j.data ?? []).map((m: { id: string }) => m.id);
  }
}

export function createProvider(s: AISettings): AIProvider | null {
  if (s.provider === 'ollama') return new OllamaProvider(s);
  if (s.provider === 'openai') return new OpenAICompatibleProvider(s);
  return null;
}

export const PROVIDER_PRESETS: { label: string; provider: AISettings['provider']; baseUrl: string; model: string; note: string; local: boolean }[] = [
  { label: 'Ollama (on this computer)', provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3.2', note: 'Free and private: the model runs on your machine. Needs a reasonably powerful computer.', local: true },
  { label: 'LM Studio (on this computer)', provider: 'openai', baseUrl: 'http://localhost:1234/v1', model: 'local-model', note: 'Free and private. Start the local server in LM Studio first.', local: true },
  { label: 'Groq (free tier, online)', provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant', note: 'Free tier with rate limits. Requires a free API key. Your selected context is sent to Groq.', local: false },
  { label: 'OpenRouter (free models, online)', provider: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.1-8b-instruct:free', note: 'Some models are free with limits. Requires a free API key. Context is sent to OpenRouter and the model host.', local: false },
  { label: 'Google AI Studio (free tier, online)', provider: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', note: 'Free tier with limits. Requires a free API key. Free-tier data may be used by Google to improve products.', local: false },
];

export const SYSTEM_PROMPT = `You are the assistant inside "Work OS", a private professional workspace.
Be concise, practical and specific. Use Markdown (headings, bullet points, short paragraphs).
Only use facts from the context provided; if something isn't in the context, say so rather than inventing it.
You can only suggest and draft — you cannot change the user's data. When you propose tasks, list them as a Markdown checklist ("- [ ] task").`;
