import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ZAI_MESSAGES_URL = 'https://api.z.ai/api/anthropic/v1/messages';
const TEXT_MODEL = 'glm-5.3';
const PDF_MODEL = 'glm-5.3-flash';
const EFFORT = 'high';
const TEXT_FILE = /\.(json|html|md|txt)$/;
const USAGE = 'node .claude/skills/beispiele-pruefen/pruefen.mjs <unit> <fall|alle|rest> [fälle]';

const [unit, target, ...skip] = process.argv.slice(2);
if (!unit || !target) throw new Error(`Aufruf: ${USAGE}`);
process.loadEnvFile(join(ROOT, '.env'));
const apiKey = process.env.TEST_ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('TEST_ANTHROPIC_API_KEY (z.ai) fehlt in .env');

const dir = join(ROOT, unit.includes('/') ? unit : join('backend/evals', unit));
const reviewPath = join(dir, 'review.md');
const review = readFileSync(reviewPath, 'utf8');
const section = (title) => review.split(`## ${title}\n`)[1]?.split('\n## ')[0]?.trim() ?? '';
const samples = join(dir, 'samples');
const cases = readdirSync(samples)
  .filter((name) => !name.includes('.'))
  .sort();

function files(id, pattern) {
  return readdirSync(join(samples, id))
    .filter((name) => pattern.test(name))
    .map((name) => {
      const text = readFileSync(join(samples, id, name), 'utf8');
      return `<datei name="${id}/${name}">\n${text}\n</datei>`;
    });
}

function system(intro, questions) {
  return `${intro} Ein anderes Modell hat die Beispiele und ihre Musterlösungen (gold.json) geschrieben. Du prüfst unabhängig: Ist der Fall fair, stimmt die Musterlösung, wirkt er echt? Prüfe streng, aber nenne nur, was du belegen kannst.

Antworte auf Deutsch, je Frage eine Zeile, die mit der Fragenummer beginnt (z. B. „F1: …“), ohne Einleitung und ohne Schlusswort.

Regeln der Testsammlung:
${section('Regeln')}

Fragen:
${questions}`;
}

async function ask(model, systemPrompt, content) {
  const response = await fetch(ZAI_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16_000,
      output_config: { effort: EFFORT },
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!response.ok) throw new Error(`z.ai ${response.status}: ${await response.text()}`);
  const message = await response.json();
  const lines = message.content
    .map((block) => block.text ?? '')
    .join('')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('- ') ? line : `- ${line}`));
  const usage = `(${message.usage.input_tokens} → ${message.usage.output_tokens} Tokens, ${message.stop_reason})`;
  return [...lines, '', usage].join('\n');
}

async function reviewText(id) {
  const intro =
    'Du prüfst erfundene Beispiele aus einer Testsammlung für eine KI-Funktion. PDFs bekommst du nicht; die Quelle (z. B. cv.html) hat denselben Inhalt.';
  const answer = await ask(
    TEXT_MODEL,
    system(intro, section('Fragen')),
    `Fall: ${id}\n\n${files(id, TEXT_FILE).join('\n\n')}`,
  );
  return `**${TEXT_MODEL} (${EFFORT})**\n\n${answer}`;
}

async function reviewPdf(id) {
  const pdf = readdirSync(join(samples, id)).find((name) => name.endsWith('.pdf'));
  const questions = section('PDF-Fragen');
  if (!pdf || !questions) return '';
  const intro =
    'Du prüfst ein erfundenes Beispiel aus einer Testsammlung für eine KI-Funktion. Du bekommst das PDF, so wie die KI-Funktion es bekommt, und die Musterlösung.';
  const data = readFileSync(join(samples, id, pdf)).toString('base64');
  const answer = await ask(PDF_MODEL, system(intro, questions), [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
    { type: 'text', text: `Fall: ${id}\n\n${files(id, /\.json$/).join('\n\n')}` },
  ]);
  return `**${PDF_MODEL} (PDF)**\n\n${answer}`;
}

async function reviewCase(id) {
  return [await reviewText(id), await reviewPdf(id)].filter(Boolean).join('\n\n');
}

if (target === 'alle') {
  const intro =
    'Du prüfst alle erfundenen Beispiele einer Testsammlung für eine KI-Funktion. PDFs bekommst du nicht; die Quellen (z. B. cv.html) haben denselben Inhalt.';
  const content = cases.flatMap((id) => files(id, TEXT_FILE)).join('\n\n');
  console.log(await ask(TEXT_MODEL, system(intro, section('Über alle Fälle')), content));
} else if (target === 'rest') {
  const open = cases.filter(
    (id) => !review.includes(`### ${id}\n`) && !skip.some((prefix) => id.startsWith(prefix)),
  );
  for (const id of open) {
    const entry = `\n### ${id}\n\n${await reviewCase(id)}\n\n**Mensch:** nicht geprüft\n\n**Urteil:** offen\n`;
    appendFileSync(reviewPath, entry);
    console.log(`${id}: eingetragen`);
  }
} else {
  const id = cases.find((name) => name.startsWith(target));
  if (!id) throw new Error(`Kein Fall beginnt mit „${target}“`);
  console.log(`### ${id}\n\n${await reviewCase(id)}`);
}
