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

const TurnSchema = z.object({ role: MessageRoleSchema, text: z.string().min(1) });

const CaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  art: z.enum(['typisch', 'rand', 'schwierig']),
  note: z.string(),
  conversation: z
    .array(TurnSchema)
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
  thinkingChars: number;
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
    const thinking = group.reduce((sum, row) => sum + row.thinkingChars, 0);
    const time = group.reduce((sum, row) => sum + row.durationMs, 0);
    const slowest = group.reduce((max, row) => (row.durationMs > max.durationMs ? row : max));
    return [
      variant,
      group.length,
      input,
      output,
      Math.round(output / group.length),
      Math.round(thinking / group.length),
      cost(group[0]?.modelId ?? '', input, output),
      seconds(time),
      seconds(time / group.length),
      `${slowest.caseId} (${seconds(slowest.durationMs)})`,
    ].join(' | ');
  });
  return [
    '| Variante | Aufrufe | Input-Tokens | Output-Tokens | Ø Output/Aufruf | Ø Thinking (Zeichen) | Kosten | Zeit gesamt | Ø Zeit/Aufruf | längster Aufruf |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
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
  turns: readonly z.infer<typeof TurnSchema>[],
) {
  const params = buildChatRequest({
    history: turns.map((turn) => ({
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
      thinking: message.content
        .map((block) => (block.type === 'thinking' ? block.thinking : ''))
        .join('')
        .trim(),
      stop: message.stop_reason ?? '–',
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      answer: `**Fehler:** ${error instanceof Error ? error.message : String(error)}`,
      thinking: '',
      stop: 'error',
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

export function checkpointIds(evalCase: EvalCase): string[] {
  const users = evalCase.conversation.filter((turn) => turn.role === 'user').length;
  return Array.from({ length: users }, (_, index) =>
    users > 1 ? `${evalCase.id}/${index + 1}` : evalCase.id,
  );
}

export function caseSection(evalCase: EvalCase, answers: readonly string[]): string {
  const parts = [`## ${evalCase.id} (${evalCase.art})`, `_${evalCase.note}_`];
  let answered = 0;
  for (const turn of evalCase.conversation) {
    if (turn.role === 'assistant') {
      parts.push(`**Coach (Skript):** ${turn.text}`);
      continue;
    }
    parts.push(`**Person:** ${turn.text}`, `**Coach (Modell):**\n\n${answers[answered] ?? ''}`);
    answered += 1;
  }
  return `${parts.join('\n\n')}\n`;
}

export function variantMarkdown(
  version: string,
  modelId: string,
  effort: Effort,
  sections: readonly string[],
): string {
  return `# Fassung ${version} · ${modelId} · Effort ${effort}\n\n${sections.join('\n---\n\n')}`;
}

export async function registerVersion(version: string, baseDir = HERE): Promise<string> {
  const dir = `${baseDir}fassungen/${version}`;
  const prompts = await loadPrompts(`${baseDir}prompts.json`);
  if (existsSync(dir) || prompts.some((entry) => entry.version === version)) {
    throw new Error(`Fassung ${version} gibt es schon.`);
  }
  await mkdir(dir, { recursive: true });
  const saved = [...prompts, { version, prompt: COACH_CHAT_SYSTEM_PROMPT }];
  await writeFile(`${baseDir}prompts.json`, `${JSON.stringify(saved, null, 2)}\n`);
  return dir;
}

export async function runCase(
  client: Anthropic,
  config: Config,
  modelId: string,
  effort: Effort,
  evalCase: EvalCase,
) {
  const answers: string[] = [];
  const rows: ResultRow[] = [];
  const thinking: string[] = [];
  const ids = checkpointIds(evalCase);
  for (const [index, turn] of evalCase.conversation.entries()) {
    if (turn.role === 'assistant') continue;
    const result = await ask(
      client,
      config,
      modelId,
      effort,
      evalCase.conversation.slice(0, index + 1),
    );
    answers.push(result.answer);
    const caseId = ids[rows.length] ?? evalCase.id;
    if (result.thinking) thinking.push(`## ${caseId}\n\n${result.thinking}\n`);
    rows.push({
      modelId,
      effort,
      caseId,
      stop: result.stop,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      thinkingChars: result.thinking.length,
      durationMs: result.durationMs,
    });
  }
  return { section: caseSection(evalCase, answers), thinking, rows };
}

export async function runCoachChatEval(args: {
  config: Config;
  client: Anthropic;
  version: string;
  log: (line: string) => void;
  baseDir?: string;
}): Promise<void> {
  const { config, client, version, log } = args;
  const baseDir = args.baseDir ?? HERE;
  const dir = await registerVersion(version, baseDir);
  const cases = await loadCases(`${baseDir}cases.json`);
  const models = resolveModels(config.anthropicBaseUrl);
  const startedAt = performance.now();

  const results = await Promise.all(
    VARIANTS.map(async ({ model, effort }) => {
      const modelId = models[model];
      const sections: string[] = [];
      const thinking: string[] = [];
      const rows: ResultRow[] = [];
      for (const evalCase of cases) {
        const result = await runCase(client, config, modelId, effort, evalCase);
        sections.push(result.section);
        thinking.push(...result.thinking);
        rows.push(...result.rows);
        for (const row of result.rows) {
          log(
            `${modelId}/${effort} ${row.caseId}: ${row.outputTokens} Tokens, ${row.durationMs} ms, ${row.stop}`,
          );
        }
      }
      await writeFile(
        `${dir}/${modelId}-${effort}.md`,
        variantMarkdown(version, modelId, effort, sections),
      );
      if (thinking.length > 0) {
        await writeFile(
          `${dir}/${modelId}-${effort}.thinking.md`,
          `# Thinking · Fassung ${version} · ${modelId} · Effort ${effort}\n\n${thinking.join('\n---\n\n')}`,
        );
      }
      return rows;
    }),
  );

  const rows = results.flat();
  const header =
    'model\teffort\tcase\tstop\tinput_tokens\toutput_tokens\tthinking_chars\tduration_ms';
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
