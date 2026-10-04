import { describe, expect, it } from 'vitest';

import { loadCases, loadPrompts, summaryTable } from '../evals/coach_chat/run';

describe('coach_chat example suite', () => {
  it('ships between 5 and 20 well-formed cases that end with a user question', async () => {
    const cases = await loadCases();

    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(cases.length).toBeLessThanOrEqual(20);
    expect(new Set(cases.map((evalCase) => evalCase.id)).size).toBe(cases.length);
    for (const evalCase of cases) expect(evalCase.conversation.at(-1)?.role).toBe('user');
  });

  it('stores every prompt version once', async () => {
    const versions = (await loadPrompts()).map((entry) => entry.version);

    expect(versions).toContain('v1');
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('sums tokens, cost and time per variant', () => {
    const row = { stop: 'end_turn', inputTokens: 100 };
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
      '| glm-5.3-flash · low | 2 | 200 | 400 | 200 | $0.0002 | 8.0 s | 4.0 s | b (6.0 s) |',
    );
    expect(table).toContain(
      '| unknown · high | 1 | 100 | 50 | 50 | – | 1.0 s | 1.0 s | a (1.0 s) |',
    );
  });
});
