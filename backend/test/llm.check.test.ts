import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import { parseConfig } from '../src/config';
import { runCheck } from '../src/llm/check';
import { createFakeLlmClient, textMessage } from '../src/llm/fake';
import { silentLogger, VALID_ENV } from './helpers';

const config = parseConfig(VALID_ENV);

function captureOutput() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    output: { log: (line: string) => logs.push(line), error: (line: string) => errors.push(line) },
  };
}

describe('llm:check', () => {
  it('sends model, max_tokens and an explicit effort and prints the metrics', async () => {
    const client = createFakeLlmClient([
      textMessage({ text: 'Er zeigt, was du kannst.', inputTokens: 40, outputTokens: 95 }),
    ]);
    const { logs, output } = captureOutput();

    const code = await runCheck({ config, client, logger: silentLogger(), output });

    expect(code).toBe(0);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 16_000,
      output_config: { effort: 'low' },
    });
    const printed = logs.join('\n');
    expect(printed).toContain('40 rein / 95 raus');
    expect(printed).toContain('Er zeigt, was du kannst.');
  });

  it('uses the advanced model when asked', async () => {
    const client = createFakeLlmClient();

    await runCheck({
      config,
      client,
      logger: silentLogger(),
      output: captureOutput().output,
      choice: 'advanced',
    });

    expect(client.calls[0]?.model).toBe('claude-opus-5-5');
  });

  it('explains a rejected api key and exits with 1', async () => {
    const error = new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers());
    const { errors, output } = captureOutput();

    const code = await runCheck({
      config,
      client: createFakeLlmClient([error]),
      logger: silentLogger(),
      output,
    });

    expect(code).toBe(1);
    expect(errors).toEqual(['Fehler: Der API-Key wird abgelehnt.']);
  });

  it('explains an unknown model and exits with 1', async () => {
    const error = new Anthropic.NotFoundError(404, {}, 'model not found', new Headers());
    const { errors, output } = captureOutput();

    const code = await runCheck({
      config,
      client: createFakeLlmClient([error]),
      logger: silentLogger(),
      output,
    });

    expect(code).toBe(1);
    expect(errors[0]).toContain("Modell 'claude-sonnet-5-5'");
  });

  it('explains a connection error and exits with 1', async () => {
    const { errors, output } = captureOutput();

    const code = await runCheck({
      config,
      client: createFakeLlmClient([new Anthropic.APIConnectionError({ message: 'offline' })]),
      logger: silentLogger(),
      output,
    });

    expect(code).toBe(1);
    expect(errors).toEqual(['Fehler: Keine Verbindung zum Anbieter.']);
  });
});
