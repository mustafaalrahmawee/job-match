import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages';

import type { Config } from '../config';

/**
 * Was die App vom SDK-Client benutzt. Der echte `Anthropic`-Client erfüllt das Interface, der
 * Fake in `fake.ts` auch – so hängt kein Service am konkreten SDK-Objekt. Wächst mit den Stufen
 * (Streaming in Stufe 1, `parse` in Stufe 2 …).
 */
export interface LlmClient {
  readonly messages: {
    create(params: MessageCreateParamsNonStreaming): Promise<Message>;
  };
}

/**
 * Baut den Client für einen Anthropic-kompatiblen Endpunkt. Kein Modul-Singleton: Der Client wird
 * immer als Parameter weitergegeben (docs/STACK.md §3.4).
 *
 * `timeout` gilt bis zum Beginn der Antwort; Wiederholungen bei Verbindungsfehlern, 429 und 5xx
 * übernimmt das SDK (`maxRetries`).
 */
export function createLlmClient(config: Config): Anthropic {
  return new Anthropic({
    apiKey: config.anthropicApiKey,
    baseURL: config.anthropicBaseUrl,
    timeout: config.llmTimeoutMs,
    maxRetries: config.llmMaxRetries,
  });
}
