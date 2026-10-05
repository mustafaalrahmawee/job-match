import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { CLAUDE_MODELS, GLM_MODELS } from '../../src/llm/models';
import { VARIANTS, loadCases } from './run';
import type { EvalCase } from './run';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export const ASPECTS = ['relevanz', 'richtigkeit', 'belegtheit', 'genug', 'nicht_zu_viel'] as const;

const Choice = z.enum(['A', 'B', 'gleich']);

const RatingSchema = z.object({
  nr: z.number().int(),
  begruendung: z.string().min(1),
  relevanz: Choice,
  richtigkeit: Choice,
  belegtheit: Choice,
  genug: Choice,
  nicht_zu_viel: Choice,
});

export type Rating = z.infer<typeof RatingSchema>;

const PairSchema = z.object({
  nr: z.number().int(),
  aufgabe: z.string(),
  variante: z.string(),
  A: z.string(),
  B: z.string(),
});

export type Pair = z.infer<typeof PairSchema>;

export function extractAnswers(markdown: string, cases: readonly EvalCase[]): Map<string, string> {
  const answers = new Map<string, string>();
  const starts = cases.map((evalCase) => markdown.indexOf(`## ${evalCase.id} (`));
  for (const [index, evalCase] of cases.entries()) {
    const start = starts[index] ?? -1;
    if (start < 0) continue;
    const end = starts.slice(index + 1).find((next) => next > start) ?? markdown.length;
    const section = markdown.slice(start, end).replace(/\n---\n*$/, '');
    const parts = section.split('**Coach (Modell):**\n\n').slice(1);
    for (const [n, part] of parts.entries()) {
      const answer = part.split(/\n\n\*\*(?:Person|Coach \(Skript\)):\*\* /)[0] ?? '';
      answers.set(parts.length > 1 ? `${evalCase.id}/${n + 1}` : evalCase.id, answer.trim());
    }
  }
  return answers;
}

function conversationUntil(evalCase: EvalCase, checkpoint: number): string {
  let users = 0;
  return evalCase.conversation
    .filter((turn) => {
      if (users === checkpoint) return false;
      if (turn.role === 'user') users += 1;
      return true;
    })
    .map((turn) => `${turn.role === 'user' ? 'Person' : 'Coach'}: ${turn.text}`)
    .join('\n\n');
}

export async function prepare(older: string, newer: string, baseDir = HERE): Promise<string> {
  const name = `${older}-${newer}`;
  const dir = `${baseDir}bewertungen/${name}`;
  if (existsSync(dir)) throw new Error(`Bewertung ${name} gibt es schon.`);
  const cases = await loadCases(`${baseDir}cases.json`);

  const file = (fassung: string, model: 'standard' | 'advanced', effort: string) => {
    const claude = `${CLAUDE_MODELS[model]}-${effort}`;
    return existsSync(`${baseDir}fassungen/${fassung}/${claude}.md`)
      ? claude
      : `${GLM_MODELS[model]}-${effort}`;
  };
  const answers = async (fassung: string, variante: string) =>
    extractAnswers(await readFile(`${baseDir}fassungen/${fassung}/${variante}.md`, 'utf8'), cases);

  const pairs: Pair[] = [];
  const blocks: string[] = [];
  for (const { model, effort } of VARIANTS) {
    const olderFile = file(older, model, effort);
    const newerFile = file(newer, model, effort);
    const variante = olderFile === newerFile ? olderFile : `${olderFile} ↔ ${newerFile}`;
    const first = await answers(older, olderFile);
    const second = await answers(newer, newerFile);
    for (const [aufgabe, olderText] of first) {
      const swap = randomInt(2) === 1;
      const pair = {
        nr: pairs.length + 1,
        aufgabe,
        variante,
        A: swap ? newer : older,
        B: swap ? older : newer,
      };
      const [caseId = '', checkpoint = '1'] = aufgabe.split('/');
      const evalCase = cases.find((entry) => entry.id === caseId);
      if (!evalCase) continue;
      const newerText = second.get(aufgabe) ?? '';
      pairs.push(pair);
      blocks.push(
        `<paar nr="${pair.nr}">\n<worauf_es_ankommt>${evalCase.note}</worauf_es_ankommt>\n<gespraech>\n${conversationUntil(evalCase, Number(checkpoint))}\n</gespraech>\n<antwort id="A">\n${swap ? newerText : olderText}\n</antwort>\n<antwort id="B">\n${swap ? olderText : newerText}\n</antwort>\n</paar>`,
      );
    }
  }

  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/paare.md`, `${blocks.join('\n\n')}\n`);
  await writeFile(`${dir}/schluessel.json`, `${JSON.stringify(pairs, null, 2)}\n`);
  await writeFile(`${dir}/bewertung.json`, '[]\n');
  return name;
}

export function count(pairs: readonly Pair[], ratings: readonly Rating[], newer: string) {
  const byNr = new Map(ratings.map((rating) => [rating.nr, rating]));
  const winner = (pair: Pair, choice: 'A' | 'B' | 'gleich') =>
    choice === 'gleich' ? 'gleich' : pair[choice] === newer ? 'neuer' : 'aelter';
  const empty = () => ({ neuer: 0, gleich: 0, aelter: 0 });
  const perAspect = Object.fromEntries(ASPECTS.map((aspect) => [aspect, empty()]));
  const perVariant: Record<string, ReturnType<typeof empty>> = {};
  for (const pair of pairs) {
    const rating = byNr.get(pair.nr);
    if (!rating) continue;
    for (const aspect of ASPECTS) {
      const result = winner(pair, rating[aspect]);
      (perAspect[aspect] ?? empty())[result] += 1;
      (perVariant[pair.variante] ??= empty())[result] += 1;
    }
  }
  return { perAspect, perVariant };
}

export async function evaluate(name: string, baseDir = HERE): Promise<string> {
  const [older = '', newer = ''] = name.split('-');
  const dir = `${baseDir}bewertungen/${name}`;
  const pairs = z
    .array(PairSchema)
    .parse(JSON.parse(await readFile(`${dir}/schluessel.json`, 'utf8')));
  const ratings = z
    .array(RatingSchema)
    .parse(JSON.parse(await readFile(`${dir}/bewertung.json`, 'utf8')));

  const rated = new Set(ratings.map((rating) => rating.nr));
  const missing = pairs.filter((pair) => !rated.has(pair.nr)).map((pair) => pair.nr);
  if (missing.length > 0) throw new Error(`Es fehlen Bewertungen für Paar ${missing.join(', ')}`);

  const { perAspect, perVariant } = count(pairs, ratings, newer);
  const row = (label: string, counts: { neuer: number; gleich: number; aelter: number }) =>
    `| ${label} | ${counts.neuer} | ${counts.gleich} | ${counts.aelter} |`;
  const header = (first: string) =>
    `| ${first} | ${newer} besser | gleich | ${older} besser |\n| --- | --- | --- | --- |`;

  const byNr = new Map(ratings.map((rating) => [rating.nr, rating]));
  const worse = pairs.flatMap((pair) => {
    const rating = byNr.get(pair.nr);
    if (!rating) return [];
    const lost = ASPECTS.filter((aspect) => {
      const choice = rating[aspect];
      return choice !== 'gleich' && pair[choice] === older;
    });
    return lost.length > 0
      ? [
          `- Paar ${pair.nr} · ${pair.aufgabe} · ${pair.variante} · ${lost.join(', ')}: ${rating.begruendung}`,
        ]
      : [];
  });

  const result = [
    `# Paarvergleich ${older} gegen ${newer}`,
    `Bewerter: Claude, blind. Pro Paar zwei Antworten desselben Modells auf dieselbe Frage, eine aus ${older}, eine aus ${newer}, in zufälliger Reihenfolge.`,
    `## Nach Aspekt\n\n${header('Aspekt')}\n${ASPECTS.map((aspect) => row(aspect, perAspect[aspect] ?? { neuer: 0, gleich: 0, aelter: 0 })).join('\n')}`,
    `## Nach Variante (alle Aspekte zusammen)\n\n${header('Variante')}\n${Object.entries(perVariant)
      .map(([variante, counts]) => row(variante, counts))
      .join('\n')}`,
    `## Wo ${older} besser war\n\n${worse.join('\n') || '–'}`,
  ].join('\n\n');
  await writeFile(`${dir}/ergebnis.md`, `${result}\n`);
  return result;
}

export async function main(args: string[]): Promise<number> {
  const [command, first, second] = args;
  if (command === 'vorbereiten' && first && second) {
    const name = await prepare(first, second);
    console.log(
      `Vorbereitet: bewertungen/${name}/paare.md\nIm anderen Claude-Fenster: /soma-bewertung ${name}`,
    );
    return 0;
  }
  if (command === 'auswerten' && first) {
    console.log(await evaluate(first));
    return 0;
  }
  console.error(
    'Aufruf: pnpm soma coach_chat vorbereiten <ältere Fassung> <neuere Fassung>\n       pnpm soma coach_chat auswerten <ältere>-<neuere>',
  );
  return 1;
}
