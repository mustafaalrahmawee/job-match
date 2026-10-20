---
name: review-loop
description: Builds and reviews one use case with two coding agents that talk only through files in .review/. This Claude Code session is the writer; the reviewer is a headless Claude Code on z.ai (glm-5.3, effort max) that zai-review.sh starts. The writer collects the context, implements backend and frontend code and asks for a review; the reviewer comments; the writer fixes; one re-review. Call /review-loop UC-04 to build and get the review, /review-loop to fix and close, /review-loop reset to start over.
disable-model-invocation: true
---

# Review loop

Arguments: **$ARGUMENTS**.

Two agents work in turns on one use case: the writer and the reviewer. They talk only through files in `.review/` at the repository root. You are the writer. The reviewer is a headless Claude Code on z.ai with its own instructions in `reviewer.md`; you start it with the script next to this file and never do a reviewer step yourself:

```bash
.claude/skills/review-loop/zai-review.sh review
```

The argument is `review` or `re-review`. Run it with Bash in the background (`run_in_background: true`) and wait for the notice; it can take several minutes. It reads the key from `backend/.env`, lets the reviewer only read files, search and run backend tests, and writes the answer to `.review/review.md` or `.review/re-review.md`. If it fails, show the user the last lines of `.review/zai-<step>.log`, stop and say that `/review-loop` retries the step.

If the arguments are `reset`, delete `.review/` and stop. In step 1 the arguments name the use case, e.g. `UC-04`, or describe the goal in words.

Scope is application code only: `backend/` and `frontend/`. Never touch `backend/evals/`, never run `pnpm evals`, never create or change a prompt unit in `backend/src/prompts/`; if the use case needs one, say so and stop. Never commit.

The rules of the project (`CLAUDE.md`, `AGENTS.md`, if they exist) apply to both roles. Write everything in `.review/` in German. A call to `/review-loop` runs every step in its row of the table below, then stops.

## Find the step

| Files in `.review/` | Steps of this call |
|---|---|
| none, or only `context.md` | 1 · build, 2 · review |
| `request.md`, no `review.md` | 2 · review |
| `review.md`, no `fixes.md` | 3 · fix, 4 · re-review, 5 · close |
| `fixes.md`, no `re-review.md` | 4 · re-review, 5 · close |
| `re-review.md` | 5 · close |

Say in one line which steps you do.

## 1 · Build (writer)

### Collect the context

1. **Use case.** Find it in `docs/APP_IDEA.md`: its row, its stage, the entities of the domain model it uses and every section that names it (e.g. a core flow). Note which other use cases it builds on.
2. **Rules.** Read `CLAUDE.md` and the docs it points to for application code. Skip eval docs (`docs/EVAL_PLAN.md`, `docs/app-evaluation-anchor.md`).
3. **Design.** If the use case has a frontend part: read `docs/design/README.md` and the screen of
   this use case in `docs/design/screens/` (the file name carries the UC). Note in `context.md` under
   "Regeln" which screen applies and which building blocks it uses.
4. **Existing code.** Search `backend/` (without `evals/`) and `frontend/` for what already exists for this use case, committed or not (`git status`): Prisma models and migrations, module files, prompt units it calls, routes in `app.ts`, tests and test helpers, frontend routes, stores, views, components and `types.ts`.
5. **Dependencies.** For each piece, what it uses (services of other domains, Prisma, `llm/`, `shared/`, API calls) and what uses it (`app.ts`, router, layout, other views).
6. **Gap.** Compare the outcome of the use case with the existing code: what is done, what is missing, what is wrong.
7. If a use case it builds on is missing, stop and tell the user which one comes first.

Write `.review/context.md`:

```markdown
# Kontext: <use case ID and name>

## Anforderung
<row of the use case and the steps of related sections, close to the source>

## Regeln
<rules that matter for this use case, with their file>

## Vorhanden
- <path> – <what it does for this use case>

## Abhängigkeiten
- <path> → <path> – <why>

## Lücke
- <what is missing or wrong>

## Plan
- <path> – <create or change, and what>

## Offene Fragen
<questions for the user, or "keine">
```

If there are open questions, show them, stop and wait. The next `/review-loop` continues with the answers.

### Implement

1. Show the plan in a few lines and implement it. Follow the patterns of the existing code. Change only what the plan names.
2. Write or extend tests for every backend outcome of the use case.
3. Run tests, linter, type check and the frontend build for what changed (commands in the README or `package.json`). Fix failures; if one stays, note it.

### Ask for the review

1. Collect the diff of every file in "Vorhanden" and "Plan" without touching the git index: `git diff HEAD -- <files>` for tracked files, `git diff --no-index /dev/null <file>` for new ones.
2. Write `.review/request.md`:

```markdown
# Review-Anfrage

Schreiber: <your tool and model, e.g. Claude Code · Opus 5.5>

## Ziel
<use case and what this change does, 2–3 sentences; requirements in context.md>

## Dateien
- <path> – <one line what changed>

## Tests
<commands and result>

## Diff
<full diff in a diff code block>
```

## 2 · Review (reviewer on z.ai)

1. Run `zai-review.sh review`.
2. Show the user the findings from `.review/review.md` in a short list: number, severity, place, problem in one line. Do not judge them yet; that is step 3.

## 3 · Fix (writer)

1. Read `context.md` and `review.md`. Check each finding against the code yourself.
2. Fix the ones that hold. Reject the ones that do not, with a reason. Change nothing that no finding asks for.
3. Run the tests again.
4. Write `.review/fixes.md`:

```markdown
# Fixes

## R1 · behoben
<what changed, with <path>:<line>>

## R2 · abgelehnt
<why the finding does not hold>

## Tests
<commands and result>
```

## 4 · Re-review (reviewer on z.ai)

Run `zai-review.sh re-review`. Its answer in `.review/re-review.md` has one line per finding, `ok` or `nicht ok` with a reason, and `N1`, `N2` for bugs the fixes brought in.

## 5 · Close (writer)

1. Show the user a table: finding, severity, result (`behoben`, `abgelehnt`, `ok`, `nicht ok`).
2. List every `nicht ok` and `N` point as open. Do not fix them; the user decides.
3. List the changed files, so the user can commit them.
4. Delete `.review/`.

## End of each call

After step 2, tell the user that `/review-loop` fixes, gets the re-review and closes. After step 5 the loop is over.
