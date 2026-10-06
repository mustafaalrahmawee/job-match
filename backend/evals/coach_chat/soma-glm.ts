import { existsSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { Config } from '../../src/config';
import { answerText, createLlmClient } from '../../src/llm/client';
import { GLM_MODELS } from '../../src/llm/models';
import { RatingSchema } from './soma';
import type { Rating } from './soma';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const VerdictSchema = RatingSchema.omit({ nr: true });

export function judgeSystemPrompt(fragen: string): string {
  return `Dies ist ein Gutachten über Antworten eines Karriere-Coaching-Assistenten. Eine Person hat eine Frage zu Bewerbung, Lebenslauf oder Vorstellungsgespräch gestellt, und zwei Assistenten haben geantwortet. Die Gutachterin vergleicht die beiden Antworten unabhängig; welche Antwort von welchem Assistenten stammt, ist verborgen.

Die Nachricht enthält einen Block <paar> mit <worauf_es_ankommt>, dem <gespraech> bis zur letzten Nachricht der Person und den Antworten <antwort id="A"> und <antwort id="B">. Verglichen wird die Antwort auf die letzte Nachricht im Gespräch.

${fragen.trim()}

Die Gutachterin antwortet ausschließlich mit einem JSON-Objekt, weil ein Skript die Wahl liest: zuerst "begruendung" mit ein bis zwei Sätzen, die den wichtigsten Unterschied nennen, dann die Felder "relevanz", "richtigkeit", "belegtheit", "genug" und "nicht_zu_viel".`;
}

export function parseVerdict(text: string): z.infer<typeof VerdictSchema> | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return undefined;
  try {
    const result = VerdictSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export async function judgeWithGlm(
  name: string,
  config: Config,
  log: (line: string) => void,
  baseDir = HERE,
): Promise<void> {
  const dir = `${baseDir}bewertungen/${name}`;
  const blocks = [
    ...(await readFile(`${dir}/paare.md`, 'utf8')).matchAll(/<paar nr="(\d+)">[\s\S]*?<\/paar>/g),
  ];
  const file = `${dir}/bewertung.json`;
  const ratings: Rating[] = existsSync(file)
    ? z.array(RatingSchema).parse(JSON.parse(await readFile(file, 'utf8')))
    : [];
  const done = new Set(ratings.map((rating) => rating.nr));
  const queue = blocks.filter((block) => !done.has(Number(block[1])));

  const client = createLlmClient(config);
  const system = judgeSystemPrompt(await readFile(`${baseDir}soma-fragen.md`, 'utf8'));
  const failed: number[] = [];

  async function worker(): Promise<void> {
    for (let block = queue.shift(); block; block = queue.shift()) {
      const nr = Number(block[1]);
      let verdict;
      for (let attempt = 0; attempt < 2 && !verdict; attempt += 1) {
        const message = await client.messages
          .stream({
            model: GLM_MODELS.advanced,
            max_tokens: config.llmMaxTokens,
            output_config: { effort: 'high' },
            system,
            messages: [{ role: 'user', content: block[0] }],
          })
          .finalMessage();
        verdict = parseVerdict(answerText(message));
      }
      if (!verdict) {
        failed.push(nr);
        log(`Paar ${nr}: keine lesbare Bewertung`);
        continue;
      }
      ratings.push({ nr, ...verdict });
      ratings.sort((a, b) => a.nr - b.nr);
      writeFileSync(file, `${JSON.stringify(ratings, null, 2)}\n`);
      log(`Paar ${nr} bewertet (${ratings.length}/${blocks.length})`);
    }
  }

  await Promise.all(Array.from({ length: 4 }, worker));
  if (failed.length > 0) {
    throw new Error(
      `Nicht bewertet: Paar ${failed.join(', ')}. Erneut aufrufen, es geht dort weiter.`,
    );
  }
}
