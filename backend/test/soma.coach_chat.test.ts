import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { count, extractAnswers } from '../evals/coach_chat/soma';
import { judgeSystemPrompt, parseVerdict } from '../evals/coach_chat/soma-glm';

const cases = [
  {
    id: 'eins',
    art: 'typisch' as const,
    note: 'n',
    conversation: [{ role: 'user' as const, text: 'Frage' }],
  },
  {
    id: 'dialog',
    art: 'schwierig' as const,
    note: 'n',
    conversation: [
      { role: 'user' as const, text: 'Frage 1' },
      { role: 'assistant' as const, text: 'Skript' },
      { role: 'user' as const, text: 'Frage 2' },
    ],
  },
];

const markdown = `# Fassung v1

## eins (typisch)

_n_

**Person:** Frage

**Coach (Modell):**

Antwort mit eigener Überschrift

## Abschnitt

---

Linie im Text
---

## dialog (schwierig)

_n_

**Person:** Frage 1

**Coach (Modell):**

Antwort 1

**Coach (Skript):** Skript

**Person:** Frage 2

**Coach (Modell):**

Antwort 2
`;

describe('pairwise comparison for coach_chat', () => {
  it('extracts every model answer, also when answers contain headings and rules', () => {
    const answers = extractAnswers(markdown, cases);

    expect([...answers.keys()]).toEqual(['eins', 'dialog/1', 'dialog/2']);
    expect(answers.get('eins')).toBe(
      'Antwort mit eigener Überschrift\n\n## Abschnitt\n\n---\n\nLinie im Text',
    );
    expect(answers.get('dialog/1')).toBe('Antwort 1');
    expect(answers.get('dialog/2')).toBe('Antwort 2');
  });

  it('turns A and B back into older and newer version before counting', () => {
    const pairs = [
      { nr: 1, aufgabe: 'eins', variante: 'flash', A: 'v1', B: 'v2' },
      { nr: 2, aufgabe: 'eins', variante: 'glm', A: 'v2', B: 'v1' },
    ];
    const rating = {
      begruendung: 'x',
      richtigkeit: 'gleich' as const,
      belegtheit: 'gleich' as const,
      genug: 'gleich' as const,
      nicht_zu_viel: 'gleich' as const,
    };

    const { perAspect, perVariant } = count(
      pairs,
      [
        { ...rating, nr: 1, relevanz: 'B' },
        { ...rating, nr: 2, relevanz: 'A' },
      ],
      'v2',
    );

    expect(perAspect.relevanz).toEqual({ neuer: 2, gleich: 0, aelter: 0 });
    expect(perAspect.genug).toEqual({ neuer: 0, gleich: 2, aelter: 0 });
    expect(perVariant.flash).toEqual({ neuer: 1, gleich: 4, aelter: 0 });
  });
});

describe('glm judge for the pairwise comparison', () => {
  it('reads the verdict from the json object and rejects invalid choices', () => {
    const verdict = {
      begruendung: 'B ist kürzer.',
      relevanz: 'gleich',
      richtigkeit: 'gleich',
      belegtheit: 'A',
      genug: 'gleich',
      nicht_zu_viel: 'B',
    };

    expect(parseVerdict(`Analyse …\n${JSON.stringify(verdict)}`)).toEqual(verdict);
    expect(parseVerdict(JSON.stringify({ ...verdict, genug: 'C' }))).toBeUndefined();
    expect(parseVerdict('kein JSON')).toBeUndefined();
  });

  it('states the questions before the pair arrives', async () => {
    const fragen = await readFile(
      new URL('../evals/coach_chat/soma-fragen.md', import.meta.url),
      'utf8',
    );
    const prompt = judgeSystemPrompt(fragen);

    expect(prompt.startsWith('Dies ist ein Gutachten')).toBe(true);
    expect(prompt).toContain('**nicht_zu_viel:**');
  });
});
