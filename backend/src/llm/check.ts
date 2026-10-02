import Anthropic from '@anthropic-ai/sdk';
import type { Logger } from 'pino';

import { ConfigError, loadConfig } from '../config';
import type { Config } from '../config';
import { createLogger } from '../logger';
import { createLlmClient } from './client';
import type { LlmClient } from './client';
import { resolveModels } from './models';
import type { Effort, ModelChoice } from './models';
import { logLlmCall, metricsFromUsage } from './usage';

/**
 * `pnpm llm:check` – ein kurzer **echter** Modellaufruf.
 *
 * Zweck: beweisen, dass Key, Base-URL und Modellnamen zusammenpassen, und zeigen, was ein Aufruf
 * kostet (Modell, Effort, Tokens, Dauer). Wird nur von Hand gestartet und kostet Geld – kein Test
 * und kein CI-Schritt ruft das Modell auf.
 */

const PROMPT = 'Antworte mit genau einem Satz: Wofür ist ein Lebenslauf gut?';
const EFFORT: Effort = 'low';

/** Ausgabekanäle als Parameter, damit ein Test mitlesen kann. */
export interface CheckOutput {
  log(line: string): void;
  error(line: string): void;
}

/**
 * Stellt eine Frage, gibt die Messwerte aus und liefert den Exit-Code. Der Client kommt von außen,
 * damit ein Test denselben Ablauf mit dem Fake prüfen kann.
 */
export async function runCheck(args: {
  config: Config;
  client: LlmClient;
  logger: Logger;
  output: CheckOutput;
  choice?: ModelChoice;
}): Promise<number> {
  const { config, client, logger, output } = args;
  const choice = args.choice ?? 'standard';
  const model = resolveModels(config.anthropicBaseUrl)[choice];
  output.log(`Anbieter: ${config.anthropicBaseUrl}\nModell:   ${model} (${choice})`);

  const started = performance.now();
  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: config.llmMaxTokens,
      // Effort immer explizit senden: Die Standardstufe ist je Modell verschieden.
      output_config: { effort: EFFORT },
      messages: [{ role: 'user', content: PROMPT }],
    });
  } catch (error) {
    // Reihenfolge zählt: die speziellen SDK-Fehlerklassen vor der allgemeinen `APIError`.
    if (error instanceof Anthropic.AuthenticationError) {
      output.error('Fehler: Der API-Key wird abgelehnt.');
    } else if (error instanceof Anthropic.NotFoundError) {
      output.error(`Fehler: Modell '${model}' kennt dieser Anbieter nicht.`);
    } else if (error instanceof Anthropic.APIConnectionError) {
      output.error('Fehler: Keine Verbindung zum Anbieter.');
    } else if (error instanceof Anthropic.APIError) {
      output.error(`Fehler vom Anbieter (${error.status ?? '?'}): ${error.message}`);
    } else {
      throw error;
    }
    return 1;
  }

  const metrics = metricsFromUsage({
    model: response.model,
    effort: EFFORT,
    usage: response.usage,
    durationMs: Math.round(performance.now() - started),
  });
  // Auch hier gilt: Jede Modellanfrage hinterlässt ihre Messwerte im Log.
  logLlmCall(logger, metrics);
  const answer = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
  output.log(
    [
      '',
      `Stopp:    ${response.stop_reason ?? '–'}`,
      `Effort:   ${metrics.effort}`,
      `Tokens:   ${metrics.inputTokens} rein / ${metrics.outputTokens} raus`,
      `Dauer:    ${metrics.durationMs} ms`,
      '',
      `Antwort:  ${answer}`,
    ].join('\n'),
  );
  return 0;
}

async function main(): Promise<number> {
  let config: Config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
  return runCheck({
    config,
    client: createLlmClient(config),
    logger: createLogger(config.logLevel),
    output: console,
  });
}

if (import.meta.main) {
  process.exitCode = await main();
}
