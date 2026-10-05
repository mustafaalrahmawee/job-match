import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { COACH_CHAT_SYSTEM_PROMPT } from '../../src/chat/chat.prompts';
import { CLAUDE_MODELS } from '../../src/llm/models';
import {
  VARIANTS,
  caseSection,
  checkpointIds,
  loadCases,
  registerVersion,
  variantMarkdown,
} from './run';
import type { EvalCase } from './run';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const AGENTS_DIR = fileURLToPath(new URL('../../../.claude/agents/', import.meta.url));

export const AGENTS = VARIANTS.map(({ model, effort }) => ({
  name: `coach-${model === 'standard' ? 'sonnet' : 'opus'}-${effort}`,
  modelId: CLAUDE_MODELS[model],
  effort,
}));

type Agent = (typeof AGENTS)[number];

export function agentFile(agent: Agent): string {
  return `---
name: ${agent.name}
description: Coach der Prompt-Unit coach_chat (${agent.modelId}, Effort ${agent.effort}). Nur für den Skill /claude-fassung.
model: ${agent.modelId}
effort: ${agent.effort}
tools: []
omitClaudeMd: true
---

${COACH_CHAT_SYSTEM_PROMPT}
`;
}

export function message(evalCase: EvalCase, checkpoint: number): string {
  let users = 0;
  const turns = evalCase.conversation.filter((turn) => {
    if (users === checkpoint) return false;
    if (turn.role === 'user') users += 1;
    return true;
  });
  if (turns.length === 1) return turns[0]?.text ?? '';
  return turns
    .map((turn) => `${turn.role === 'user' ? 'Person' : 'Coach'}: ${turn.text}`)
    .join('\n\n');
}

async function staleAgents(): Promise<string[]> {
  const stale: string[] = [];
  for (const agent of AGENTS) {
    const current = await readFile(`${AGENTS_DIR}${agent.name}.md`, 'utf8').catch(() => '');
    if (current !== agentFile(agent)) stale.push(agent.name);
  }
  return stale;
}

const AnswerSchema = z.object({
  aufgabe: z.string(),
  agent: z.string(),
  antwort: z.string().min(1),
  tokens: z.number().optional(),
  dauer_ms: z.number().optional(),
});

export async function prepare(version: string, baseDir = HERE): Promise<number> {
  const stale = await staleAgents();
  if (stale.length > 0) {
    throw new Error(
      `Agent-Dateien passen nicht zum Prompt (${stale.join(', ')}). Erst \`pnpm eval-claude coach_chat agenten\`, dann ein neues Claude-Code-Fenster öffnen.`,
    );
  }
  const dir = await registerVersion(version, baseDir);
  const cases = await loadCases(`${baseDir}cases.json`);
  const eingaben = cases.flatMap((evalCase) =>
    checkpointIds(evalCase).map((aufgabe, index) => ({
      aufgabe,
      nachricht: message(evalCase, index + 1),
    })),
  );
  await writeFile(`${dir}/eingaben.json`, `${JSON.stringify(eingaben, null, 2)}\n`);
  await writeFile(`${dir}/antworten.json`, '[]\n');
  return eingaben.length;
}

export async function assemble(version: string, baseDir = HERE): Promise<string[]> {
  const dir = `${baseDir}fassungen/${version}`;
  const cases = await loadCases(`${baseDir}cases.json`);
  const answers = z
    .array(AnswerSchema)
    .parse(JSON.parse(await readFile(`${dir}/antworten.json`, 'utf8')));
  const byKey = new Map(answers.map((answer) => [`${answer.aufgabe}#${answer.agent}`, answer]));

  const missing = AGENTS.flatMap((agent) =>
    cases.flatMap(checkpointIds).filter((aufgabe) => !byKey.has(`${aufgabe}#${agent.name}`)),
  );
  if (missing.length > 0) throw new Error(`Es fehlen Antworten: ${missing.join(', ')}`);

  const files: string[] = [];
  const metrics = ['model\teffort\tcase\ttokens\tduration_ms'];
  for (const agent of AGENTS) {
    const sections = cases.map((evalCase) =>
      caseSection(
        evalCase,
        checkpointIds(evalCase).map((id) => byKey.get(`${id}#${agent.name}`)?.antwort ?? ''),
      ),
    );
    const file = `${agent.modelId}-${agent.effort}.md`;
    await writeFile(
      `${dir}/${file}`,
      variantMarkdown(version, agent.modelId, agent.effort, sections),
    );
    files.push(file);
    for (const aufgabe of cases.flatMap(checkpointIds)) {
      const answer = byKey.get(`${aufgabe}#${agent.name}`);
      metrics.push(
        [agent.modelId, agent.effort, aufgabe, answer?.tokens ?? '–', answer?.dauer_ms ?? '–'].join(
          '\t',
        ),
      );
    }
  }
  await writeFile(`${dir}/metrics.tsv`, `${metrics.join('\n')}\n`);
  return files;
}

export async function main(args: string[]): Promise<number> {
  const [command, version] = args;
  if (command === 'agenten') {
    await mkdir(AGENTS_DIR, { recursive: true });
    for (const agent of AGENTS) await writeFile(`${AGENTS_DIR}${agent.name}.md`, agentFile(agent));
    console.log(`Agent-Dateien geschrieben: ${AGENTS.map((agent) => agent.name).join(', ')}`);
    return 0;
  }
  if (command === 'vorbereiten' && version && /^[a-z0-9-]+$/.test(version)) {
    console.log(
      `Vorbereitet: fassungen/${version}/eingaben.json (${await prepare(version)} Aufgaben)`,
    );
    return 0;
  }
  if (command === 'zusammenstellen' && version) {
    console.log(`Geschrieben: ${(await assemble(version)).join(', ')}`);
    return 0;
  }
  console.error(
    'Aufruf: pnpm eval-claude coach_chat agenten | vorbereiten <fassung> | zusammenstellen <fassung>',
  );
  return 1;
}
