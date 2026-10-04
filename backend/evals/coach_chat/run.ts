import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type Anthropic from '@anthropic-ai/sdk';
import { MessageRoleSchema } from '@job-match/shared';
import type { Effort, ModelChoice } from '@job-match/shared';
import { z } from 'zod';

import { COACH_CHAT_SYSTEM_PROMPT, buildChatRequest } from '../../src/chat/chat.prompts';
import { ROOT_ENV_FILE, parseConfig } from '../../src/config';
import type { Config } from '../../src/config';
import { answerText, createLlmClient } from '../../src/llm/client';
import { PRICES_USD_PER_MILLION, ZAI_BASE_URL, resolveModels } from '../../src/llm/models';

const CaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  note: z.string().optional(),
  conversation: z
    .array(z.object({ role: MessageRoleSchema, text: z.string().min(1) }))
    .min(1)
    .refine((turns) => turns.at(-1)?.role === 'user', 'Der Verlauf muss mit einer Frage enden'),
});

export type EvalCase = z.infer<typeof CaseSchema>;

const PromptVersionSchema = z.object({ version: z.string(), prompt: z.string().min(1) });

export type PromptVersion = z.infer<typeof PromptVersionSchema>;

export const VARIANTS: readonly { model: ModelChoice; effort: Effort }[] = [
  { model: 'standard', effort: 'low' },
  { model: 'standard', effort: 'high' },
  { model: 'advanced', effort: 'low' },
  { model: 'advanced', effort: 'high' },
];

export interface ResultRow {
  modelId: string;
  effort: Effort;
  caseId: string;
  stop: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function cost(modelId: string, input: number, output: number): string {
  const price = Object.hasOwn(PRICES_USD_PER_MILLION, modelId)
    ? PRICES_USD_PER_MILLION[modelId]
    : undefined;
  if (!price) return '–';
  return `$${((input * price.input + output * price.output) / 1_000_000).toFixed(4)}`;
}

export function summaryTable(rows: readonly ResultRow[]): string {
  const variants = Map.groupBy(rows, (row) => `${row.modelId} · ${row.effort}`);
  const lines = [...variants].map(([variant, group]) => {
    const output = group.reduce((sum, row) => sum + row.outputTokens, 0);
    const input = group.reduce((sum, row) => sum + row.inputTokens, 0);
    const time = group.reduce((sum, row) => sum + row.durationMs, 0);
    const slowest = group.reduce((max, row) => (row.durationMs > max.durationMs ? row : max));
    return [
      variant,
      group.length,
      input,
      output,
      Math.round(output / group.length),
      cost(group[0]?.modelId ?? '', input, output),
      seconds(time),
      seconds(time / group.length),
      `${slowest.caseId} (${seconds(slowest.durationMs)})`,
    ].join(' | ');
  });
  return [
    '| Variante | Fragen | Input-Tokens | Output-Tokens | Ø Output/Frage | Kosten | Zeit gesamt | Ø Zeit/Frage | längste Frage |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...lines.map((line) => `| ${line} |`),
  ].join('\n');
}

const HERE = fileURLToPath(new URL('.', import.meta.url));

export async function loadCases(file = `${HERE}cases.json`): Promise<EvalCase[]> {
  return z.array(CaseSchema).parse(JSON.parse(await readFile(file, 'utf8')));
}

export async function loadPrompts(file = `${HERE}prompts.json`): Promise<PromptVersion[]> {
  if (!existsSync(file)) return [];
  return z.array(PromptVersionSchema).parse(JSON.parse(await readFile(file, 'utf8')));
}

async function ask(
  client: Anthropic,
  config: Config,
  model: string,
  effort: Effort,
  evalCase: EvalCase,
) {
  const params = buildChatRequest({
    history: evalCase.conversation.map((turn) => ({
      role: turn.role,
      content: [{ type: 'text' as const, text: turn.text }],
    })),
    model,
    effort,
    maxTokens: config.llmMaxTokens,
    historyLimit: config.chatHistoryLimit,
  });
  const startedAt = performance.now();
  try {
    const message = await client.messages.stream(params).finalMessage();
    return {
      answer: answerText(message),
      stop: message.stop_reason ?? '–',
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      answer: `**Fehler:** ${error instanceof Error ? error.message : String(error)}`,
      stop: 'error',
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function transcript(evalCase: EvalCase): string {
  return evalCase.conversation
    .map((turn) => `**${turn.role === 'user' ? 'Person' : 'Coach'}:** ${turn.text}`)
    .join('\n\n');
}

export async function runCoachChatEval(args: {
  config: Config;
  client: Anthropic;
  version: string;
  log: (line: string) => void;
  casesFile?: string;
  promptsFile?: string;
  versionsDir?: string;
}): Promise<void> {
  const { config, client, version, log } = args;
  const promptsFile = args.promptsFile ?? `${HERE}prompts.json`;
  const dir = `${args.versionsDir ?? `${HERE}fassungen`}/${version}`;
  const prompts = await loadPrompts(promptsFile);
  if (existsSync(dir) || prompts.some((entry) => entry.version === version)) {
    throw new Error(`Fassung ${version} gibt es schon.`);
  }
  await mkdir(dir, { recursive: true });
  const saved = [...prompts, { version, prompt: COACH_CHAT_SYSTEM_PROMPT }];
  await writeFile(promptsFile, `${JSON.stringify(saved, null, 2)}\n`);

  const cases = await loadCases(args.casesFile);
  const models = resolveModels(config.anthropicBaseUrl);
  const startedAt = performance.now();

  const results = await Promise.all(
    VARIANTS.map(async ({ model, effort }) => {
      const modelId = models[model];
      const sections: string[] = [];
      const rows: ResultRow[] = [];
      for (const evalCase of cases) {
        const result = await ask(client, config, modelId, effort, evalCase);
        sections.push(
          `## ${evalCase.id}\n\n_${evalCase.note ?? ''}_\n\n${transcript(evalCase)}\n\n**Coach (Antwort):**\n\n${result.answer}\n`,
        );
        rows.push({
          modelId,
          effort,
          caseId: evalCase.id,
          stop: result.stop,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: result.durationMs,
        });
        log(
          `${modelId}/${effort} ${evalCase.id}: ${result.outputTokens} Tokens, ${result.durationMs} ms, ${result.stop}`,
        );
      }
      await writeFile(
        `${dir}/${modelId}-${effort}.md`,
        `# Fassung ${version} · ${modelId} · Effort ${effort}\n\n${sections.join('\n---\n\n')}`,
      );
      return rows;
    }),
  );

  const rows = results.flat();
  const header = 'model\teffort\tcase\tstop\tinput_tokens\toutput_tokens\tduration_ms';
  const tsv = rows.map((row) => Object.values(row).join('\t'));
  await writeFile(`${dir}/metrics.tsv`, `${[header, ...tsv].join('\n')}\n`);
  const summary = `# Fassung ${version}\n\nLaufzeit (Varianten parallel): ${seconds(performance.now() - startedAt)}\n\n${summaryTable(rows)}\n`;
  await writeFile(`${dir}/summary.md`, summary);
  log(summary);
}

export async function main(args: string[]): Promise<number> {
  const version = args[0] ?? '';
  if (!/^[a-z0-9-]+$/.test(version)) {
    console.error('Aufruf: pnpm eval coach_chat <fassung>   (z. B. v1)');
    return 1;
  }
  if (existsSync(ROOT_ENV_FILE)) process.loadEnvFile(ROOT_ENV_FILE);
  if (!process.env.TEST_ANTHROPIC_API_KEY) {
    console.error('TEST_ANTHROPIC_API_KEY fehlt in der .env (z.ai-Key, siehe .env.example).');
    return 1;
  }
  const config = parseConfig({
    ...process.env,
    ANTHROPIC_API_KEY: process.env.TEST_ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL: process.env.TEST_ANTHROPIC_BASE_URL ?? ZAI_BASE_URL,
  });
  await runCoachChatEval({ config, client: createLlmClient(config), version, log: console.log });
  return 0;
}
