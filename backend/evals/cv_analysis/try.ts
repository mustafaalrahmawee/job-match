import { readFile } from 'node:fs/promises';

import { loadConfig } from '../../src/config';
import { createLlmClient } from '../../src/llm/client';
import { buildCvAnalysisRequest } from '../../src/profile/profile.prompts';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Aufruf: pnpm cv:try <pdf>');
  process.exit(1);
}

const config = loadConfig();
if (new URL(config.anthropicBaseUrl).host !== 'api.anthropic.com') {
  console.error('cv:try braucht Claude: ANTHROPIC_BASE_URL muss api.anthropic.com sein.');
  process.exit(1);
}
const client = createLlmClient(config);

const pdfBase64 = (await readFile(pdfPath)).toString('base64');
const startedAt = performance.now();
const message = await client.messages.parse(
  buildCvAnalysisRequest(pdfBase64, config.llmMaxTokens),
  { timeout: 180_000 },
);

console.log(`Modell: ${message.model}`);
console.log(`stop_reason: ${message.stop_reason}`);
console.log(`usage: ${JSON.stringify(message.usage)}`);
console.log(`Dauer: ${Math.round(performance.now() - startedAt)} ms`);
console.log(`Blöcke: ${message.content.map((block) => block.type).join(', ')}`);
console.log(JSON.stringify(message.parsed_output, null, 2));
