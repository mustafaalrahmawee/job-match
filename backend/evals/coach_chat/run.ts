import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';
import { EffortSchema, MessageRoleSchema, ModelChoiceSchema } from '@job-match/shared';
import type { Logger } from 'pino';
import { z } from 'zod';

import { buildChatRequest } from '../../src/chat/chat.prompts';
import { loadConfig } from '../../src/config';
import type { Config } from '../../src/config';
import { answerText, createLlmClient, logLlmCall } from '../../src/llm/client';
import { resolveModels } from '../../src/llm/models';
import { createLogger } from '../../src/logger';

/**
 * Beispiel-Suite der Prompt-Unit `coach_chat` (`pnpm eval coach_chat`).
 *
 * Baut den Prompt mit derselben Funktion wie die App (`buildChatRequest`), holt die Antwort vom
 * **echten** Modell und schreibt sie nach `outputs/`. Das kostet Geld und läuft nur von Hand,
 * nie in CI. Die Antworten werden committet: Ihr Diff zeigt, was eine Prompt-Änderung bewirkt.
 * Messwerte (Modell, Effort, Tokens, Dauer) landen getrennt in `outputs/_metrics.tsv`, damit
 * schwankende Zahlen die Diffs der Antworten nicht verrauschen.
 */

const CaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  note: z.string().optional(),
  model: ModelChoiceSchema.default('standard'),
  effort: EffortSchema.default('low'),
  // Das letzte Element ist die Frage, auf die der Coach antwortet.
  conversation: z
    .array(z.object({ role: MessageRoleSchema, text: z.string().min(1) }))
    .min(1)
    .refine((turns) => turns.at(-1)?.role === 'user', 'Der Verlauf muss mit einer Frage enden'),
});

export type EvalCase = z.infer<typeof CaseSchema>;

const HERE = fileURLToPath(new URL('.', import.meta.url));

export async function loadCases(casesDir = `${HERE}cases`): Promise<EvalCase[]> {
  const files = (await readdir(casesDir)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (file) =>
      CaseSchema.parse(JSON.parse(await readFile(`${casesDir}/${file}`, 'utf8'))),
    ),
  );
}

export interface EvalOutput {
  log(line: string): void;
}

export async function runCoachChatEval(args: {
  config: Config;
  client: Anthropic;
  logger: Logger;
  output: EvalOutput;
  casesDir?: string;
  outputsDir?: string;
}): Promise<void> {
  const { config, client, logger, output } = args;
  const outputsDir = args.outputsDir ?? `${HERE}outputs`;
  await mkdir(outputsDir, { recursive: true });
  const models = resolveModels(config.anthropicBaseUrl);

  const metrics = ['case\tmodel\teffort\tstop\tinput_tokens\toutput_tokens\tduration_ms'];
  for (const evalCase of await loadCases(args.casesDir)) {
    const params = buildChatRequest({
      history: evalCase.conversation.map((turn) => ({
        role: turn.role,
        content: [{ type: 'text' as const, text: turn.text }],
      })),
      model: models[evalCase.model],
      effort: evalCase.effort,
      maxTokens: config.llmMaxTokens,
      historyLimit: config.chatHistoryLimit,
    });

    const startedAt = performance.now();
    const final = await client.messages.stream(params).finalMessage();
    const callMetrics = logLlmCall(logger, { message: final, effort: evalCase.effort, startedAt });

    const answer = answerText(final);
    const question = evalCase.conversation.at(-1)?.text ?? '';
    await writeFile(
      `${outputsDir}/${evalCase.id}.md`,
      `# ${evalCase.id}\n\n${evalCase.note ?? ''}\n\n**Frage:** ${question}\n\n---\n\n${answer}\n`,
    );
    metrics.push(
      [
        evalCase.id,
        callMetrics.model,
        callMetrics.effort,
        final.stop_reason ?? '–',
        callMetrics.inputTokens,
        callMetrics.outputTokens,
        callMetrics.durationMs,
      ].join('\t'),
    );
    output.log(
      `${evalCase.id}: ${callMetrics.inputTokens} rein / ${callMetrics.outputTokens} raus, ` +
        `${callMetrics.durationMs} ms, Stopp ${final.stop_reason ?? '–'}`,
    );
  }
  await writeFile(`${outputsDir}/_metrics.tsv`, `${metrics.join('\n')}\n`);
}

/** Wird von `evals/run.ts` aufgerufen. */
export async function main(): Promise<number> {
  const config = loadConfig();
  await runCoachChatEval({
    config,
    client: createLlmClient(config),
    logger: createLogger(config.logLevel),
    output: console,
  });
  return 0;
}
