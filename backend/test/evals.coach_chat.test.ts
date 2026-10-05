import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { loadCases, loadPrompts, runCase, summaryTable } from '../evals/coach_chat/run';
import { parseConfig } from '../src/config';
import { VALID_ENV } from './helpers';

describe('coach_chat example suite', () => {
  it('ships between 5 and 20 well-formed cases that end with a user question', async () => {
    const cases = await loadCases();

    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(cases.length).toBeLessThanOrEqual(20);
    expect(new Set(cases.map((evalCase) => evalCase.id)).size).toBe(cases.length);
    for (const evalCase of cases) expect(evalCase.conversation.at(-1)?.role).toBe('user');
    expect(new Set(cases.map((evalCase) => evalCase.art))).toEqual(
      new Set(['typisch', 'rand', 'schwierig']),
    );
  });

  it('asks the model at every user turn and continues with the scripted answer', async () => {
    const stream = vi.fn(() => ({
      finalMessage: () =>
        Promise.resolve({
          content: [
            { type: 'thinking', thinking: 'Überlegung', signature: '' },
            { type: 'text', text: 'Modellantwort' },
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
    }));
    const client = { messages: { stream } } as unknown as Anthropic;

    const { section, thinking, rows } = await runCase(client, parseConfig(VALID_ENV), 'm', 'low', {
      id: 'dialog',
      art: 'schwierig',
      note: 'Notiz',
      conversation: [
        { role: 'user', text: 'Frage 1' },
        { role: 'assistant', text: 'Skript 1' },
        { role: 'user', text: 'Frage 2' },
      ],
    });

    const sent = stream.mock.calls.map(
      (call: unknown[]) => (call[0] as { messages: unknown[] }).messages.length,
    );
    expect(sent).toEqual([1, 3]);
    expect(rows.map((row) => row.caseId)).toEqual(['dialog/1', 'dialog/2']);
    expect(section).toContain('**Coach (Skript):** Skript 1');
    expect(section).not.toContain('Überlegung');
    expect(thinking).toEqual(['## dialog/1\n\nÜberlegung\n', '## dialog/2\n\nÜberlegung\n']);
    expect(rows.map((row) => row.thinkingChars)).toEqual([10, 10]);
    expect(section.match(/\*\*Coach \(Modell\):\*\*/g)).toHaveLength(2);
  });

  it('stores every prompt version once', async () => {
    const versions = (await loadPrompts()).map((entry) => entry.version);

    expect(versions).toContain('v1');
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('sums tokens, cost and time per variant', () => {
    const row = { stop: 'end_turn', inputTokens: 100, thinkingChars: 1000 };
    const table = summaryTable([
      {
        ...row,
        modelId: 'glm-5.3-flash',
        effort: 'low',
        caseId: 'a',
        outputTokens: 300,
        durationMs: 2000,
      },
      {
        ...row,
        modelId: 'glm-5.3-flash',
        effort: 'low',
        caseId: 'b',
        outputTokens: 100,
        durationMs: 6000,
      },
      {
        ...row,
        modelId: 'unknown',
        effort: 'high',
        caseId: 'a',
        outputTokens: 50,
        durationMs: 1000,
      },
    ]);

    expect(table).toContain(
      '| glm-5.3-flash · low | 2 | 200 | 400 | 200 | 1000 | $0.0002 | 8.0 s | 4.0 s | b (6.0 s) |',
    );
    expect(table).toContain(
      '| unknown · high | 1 | 100 | 50 | 50 | 1000 | – | 1.0 s | 1.0 s | a (1.0 s) |',
    );
  });
});
