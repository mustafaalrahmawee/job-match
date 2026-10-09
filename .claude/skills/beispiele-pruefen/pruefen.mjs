import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ZAI_MESSAGES_URL = 'https://api.z.ai/api/anthropic/v1/messages';
const MODEL = 'glm-5.3';
const EFFORT = 'high';
const TEXT_FILE = /\.(json|html|md|txt)$/;

const [unit, fall] = process.argv.slice(2);
if (!unit || !fall) {
  throw new Error('Aufruf: node .claude/skills/beispiele-pruefen/pruefen.mjs <unit> <fall|alle>');
}
process.loadEnvFile(join(ROOT, '.env'));
const apiKey = process.env.TEST_ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('TEST_ANTHROPIC_API_KEY (z.ai) fehlt in .env');

const dir = join(ROOT, unit.includes('/') ? unit : join('backend/evals', unit));
const review = readFileSync(join(dir, 'review.md'), 'utf8');
const section = (title) => review.split(`## ${title}\n`)[1]?.split('\n## ')[0]?.trim() ?? '';
const samples = join(dir, 'samples');
const cases = fall === 'alle' ? readdirSync(samples).filter((name) => !name.includes('.')) : [fall];
const files = cases.flatMap((id) =>
  readdirSync(join(samples, id))
    .filter((name) => TEXT_FILE.test(name))
    .map((name) => {
      const text = readFileSync(join(samples, id, name), 'utf8');
      return `<datei name="${id}/${name}">\n${text}\n</datei>`;
    }),
);
const questions = fall === 'alle' ? section('Über alle Fälle') : section('Fragen');

const system = `Du prüfst erfundene Beispiele aus einer Testsammlung für eine KI-Funktion. Ein anderes Modell hat die Beispiele und ihre Musterlösungen (gold.json) geschrieben. Du prüfst unabhängig: Ist der Fall fair, stimmt die Musterlösung, wirkt er echt? Prüfe streng, aber nenne nur, was du mit einem Zitat aus den Dateien belegen kannst. PDFs bekommst du nicht; die Quelle (z. B. cv.html) hat denselben Inhalt.

Antworte auf Deutsch, je Frage eine Zeile im Format „F1: …“ bzw. „G1: …“, ohne Einleitung und ohne Schlusswort.

Regeln der Testsammlung:
${section('Regeln')}

Fragen:
${questions}`;

const response = await fetch(ZAI_MESSAGES_URL, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 16_000,
    output_config: { effort: EFFORT },
    system,
    messages: [{ role: 'user', content: `Fall: ${fall}\n\n${files.join('\n\n')}` }],
  }),
});
if (!response.ok) throw new Error(`z.ai ${response.status}: ${await response.text()}`);
const message = await response.json();

console.log(
  message.content
    .map((block) => block.text ?? '')
    .join('')
    .trim(),
);
console.log(
  `\n(${MODEL}, Effort ${EFFORT}, ${message.usage.input_tokens} → ${message.usage.output_tokens} Tokens, ${message.stop_reason})`,
);
