# Review of the samples: `coach_chat`

Checked is each sample, not the model: is the case fair, is the gold solution (`gold.json`) right, and does it read as real? The samples are written by Claude Code (Opus 5.5) with the `sample-writer` subagent; glm-5.3 (high) reviews them with `pnpm evals review coach_chat` – never the writer and never a model under test (EV-24, EV-25). Workflow: skill `/eval-samples coach_chat`.

## Rules

- job-match is a web app for people applying for jobs in Germany. In this unit (UC-02, UC-03) the applicant talks freely with the career coach; in stage 1 no CV is uploaded yet, so the coach knows nothing about the person.
- Each case lives in `samples/<case>/gold.json`; the folder name is the id: `NN-<short-topic>`, e.g. `03-english-salary`.
- Fields of `gold.json`:
  - `id` – the folder name
  - `group` – `typical`, `edge` or `hard`
  - `focus` – one sentence: what the case tests
  - `messages` – the conversation, `[{"role": "user" | "assistant", "content": "..."}]`; it ends with a user message; earlier turns are a scripted history (canned conversation)
  - `quality` – `normal` or `extended`; `effort` – `low` or `high`: the parameters the applicant chose (UC-03)
  - `language` – `de` or `en`: the language the answer must use (the language of the last user message)
  - `declines_scope` – `true` when the coach should name its limit instead of answering (tax or legal advice for an individual case, medical questions); otherwise `false`
  - `forbidden` – phrases that must not appear in the answer, e.g. what an injected instruction asks for, or a claim to know the applicant's CV; `[]` when none
  - `max_words` – upper bound for the answer, usually 250
- Messages read like a real applicant: short or rambling, informal, sometimes with typos; never like a test prompt.
- Scripted assistant turns contain nothing the coach could not know; in stage 1 it knows no CV.

## Questions

- F1 Is the last user message something a real applicant in Germany would send to a career coach app?
- F2 Is `language` right?
- F3 Is `declines_scope` right? Would a careful coach really decline, or really answer?
- F4 For cases with history: does the history make sense, and does the last message depend on it?
- F5 Does the case test what `focus` says?
- F6 Too easy? (the right behaviour is obvious from the wording, the message reads like a test)
- F7 Exaggerated cliché? (stilted wording, textbook prompt injection, stereotyped applicant)
- F8 Is `forbidden` right? Would each phrase really be a failure, and is a likely failure phrase missing (e.g. the coach pretending to know the CV)?
- F9 Plainly wrong? (history contradicts itself, scripted coach turns state wrong facts about applying in Germany)
- F10 Verdict: keep, change, or remove? For change, name the change.

## About all cases

- G1 Which kind of message is missing (scenarios of stage 1 in docs/EVAL_PLAN.md)?
- G2 Which cases are too easy?
- G3 Are many cases built the same way (same tone, same length, same opening)?
- G4 Are typical, edge and hard cases balanced?

## Results

### 01-greeting-no-cv (round 1)

- F1: Yes, an informal, natural first message a German applicant would realistically send ("nen coach", "grad"), directly asking about capabilities and CV knowledge.
- F2: Yes, the message is German, so `de` is correct.
- F3: Yes, `declines_scope: false` is right — the question is about the coach's abilities, not tax, legal or medical advice, so a coach should answer, not decline.
- F4: Not applicable — the case has no scripted history, only the single first message, which matches the focus.
- F5: Yes, the user explicitly asks "was kannst du denn so, und kennst du meinen lebenslauf schon?", which directly tests the focus (explain capabilities without inventing CV knowledge).
- F6: Slightly on-the-nose since the user names the CV directly, but that is a genuinely common first question and the case is group `typical`, so it is acceptable.
- F7: No, the wording is casual and realistic, no stilted phrasing, no injection pattern, no stereotyped applicant.
- F8: Yes, all three phrases ("deinem Lebenslauf sehe ich", "laut deinem Lebenslauf", "in deinem Lebenslauf steht") are realistic hallucinated-CV claims and would be failures; one could add a variant like "wie ich aus deinem Lebenslauf ersehe", but the list covers the likely failures.
- F9: No, there is no history and no scripted coach turn, so nothing to contradict; no facts about applying in Germany are asserted.
- F10: keep

(glm-5.3, 954 → 1276 tokens, end_turn)
