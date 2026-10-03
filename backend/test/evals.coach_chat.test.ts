import { describe, expect, it } from 'vitest';

import { loadCases } from '../evals/coach_chat/run';

describe('coach_chat example suite', () => {
  it('ships between 5 and 20 well-formed cases that end with a user question', async () => {
    const cases = await loadCases();

    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(cases.length).toBeLessThanOrEqual(20);
    expect(new Set(cases.map((evalCase) => evalCase.id)).size).toBe(cases.length);
    for (const evalCase of cases) expect(evalCase.conversation.at(-1)?.role).toBe('user');
  });
});
