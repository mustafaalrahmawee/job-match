import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { AGENTS, agentFile, message } from '../evals/coach_chat/claude';
import { loadPrompts } from '../evals/coach_chat/run';

describe('claude version of the coach_chat suite', () => {
  it('ships agent files whose system prompt is the prompt of a recorded version', async () => {
    const prompts = (await loadPrompts()).map((entry) => entry.prompt);
    for (const agent of AGENTS) {
      const file = await readFile(
        new URL(`../../.claude/agents/${agent.name}.md`, import.meta.url),
        'utf8',
      );
      expect(prompts.map((prompt) => agentFile(agent, prompt))).toContain(file);
    }
  });

  it('sends a single question as is and a dialog as a transcript up to the checkpoint', () => {
    const dialog = {
      id: 'dialog',
      art: 'schwierig' as const,
      note: 'n',
      conversation: [
        { role: 'user' as const, text: 'Frage 1' },
        { role: 'assistant' as const, text: 'Skript' },
        { role: 'user' as const, text: 'Frage 2' },
      ],
    };

    expect(message(dialog, 1)).toBe('Frage 1');
    expect(message(dialog, 2)).toBe('Person: Frage 1\n\nCoach: Skript\n\nPerson: Frage 2');
  });
});
