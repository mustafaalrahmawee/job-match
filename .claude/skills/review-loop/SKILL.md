---
name: review-loop
description: Builds and reviews one use case with two coding agents (writer and reviewer) that talk only through files in .review/. The writer collects the context, implements backend and frontend code and asks for a review; the reviewer comments; the writer fixes; one re-review. Each call detects the next step from the files there. Call /review-loop UC-04 to start, /review-loop to continue, /review-loop reset to start over.
disable-model-invocation: true
---

# Review loop

Arguments: **$ARGUMENTS**.

Two agents work in turns on one use case: the writer and the reviewer. They talk only through files in `.review/` at the repository root. Each call does one step, then stops and tells the user who is next.

If the arguments are `reset`, delete `.review/` and stop. In step 1 the arguments name the use case, e.g. `UC-04`, or describe the goal in words.

Scope is application code only: `backend/` and `frontend/`. Never touch `backend/evals/`, never run `pnpm evals`, never create or change a prompt unit in `backend/src/prompts/`; if the use case needs one, say so and stop. Never commit.

The rules of the project (`CLAUDE.md`, `AGENTS.md`, if they exist) apply to both roles. Write everything in `.review/` in German.

## Find the step

| Files in `.review/` | Step | Role |
|---|---|---|
| none, or only `context.md` | 1 · build | writer |
| `request.md` | 2 · review | reviewer |
| `review.md`, no `fixes.md` | 3 · fix | writer |
| `fixes.md`, no `re-review.md` | 4 · re-review | reviewer |
| `re-review.md` | 5 · close | writer |

In step 1 you become the writer. From step 2 on, read the line `Schreiber:` in `request.md`: do a writer step only if you are that tool, a reviewer step only if you are not. Otherwise stop and tell the user to call `/review-loop` in the other tool.

Say in one line which step you do and in which role.

## 1 · Build (writer)

### Collect the context

1. **Use case.** Find it in `docs/APP_IDEA.md`: its row, its stage, the entities of the domain model it uses and every section that names it (e.g. a core flow). Note which other use cases it builds on.
2. **Rules.** Read `CLAUDE.md` and the docs it points to for application code. Skip eval docs (`docs/EVAL_PLAN.md`, `docs/app-evaluation-anchor.md`).
3. **Existing code.** Search `backend/` (without `evals/`) and `frontend/` for what already exists for this use case, committed or not (`git status`): Prisma models and migrations, module files, prompt units it calls, routes in `app.ts`, tests and test helpers, frontend routes, stores, views, components and `types.ts`.
4. **Dependencies.** For each piece, what it uses (services of other domains, Prisma, `llm/`, `shared/`, API calls) and what uses it (`app.ts`, router, layout, other views).
5. **Gap.** Compare the outcome of the use case with the existing code: what is done, what is missing, what is wrong.
6. If a use case it builds on is missing, stop and tell the user which one comes first.

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

## 2 · Review (reviewer)

1. Read `context.md`, `request.md` and the rule files named in `context.md`.
2. Open the changed files themselves and the code around them: callers, tests, schemas, frontend calls of the API. The diff is the starting point, not the whole picture.
3. Check that every part of "Anforderung" is met. Look for wrong behavior, missing edge cases, security gaps (authentication, access to other users' data), missing or weak tests and broken project rules. Report style only when it breaks a written rule. No praise, no retelling of the diff.
4. Check every finding against the code before writing it down. Drop what you cannot back up.
5. Never change code. Running tests is allowed.
6. Write `.review/review.md`, most important first, at most 10 findings. Severity is `Fehler` (wrong behavior now), `Lücke` (part of the requirement missing), `Risiko` (breaks later or unsafe) or `Regel` (breaks a written rule). With no findings write `Keine Funde.`

```markdown
# Review

## R1 · Fehler · <path>:<line>
**Problem:** <what is wrong>
**Warum:** <what happens because of it, with a concrete input>
**Vorschlag:** <how to fix it>
```

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

## 4 · Re-review (reviewer)

1. Read `review.md` and `fixes.md`, then look at the code at each named place.
2. For each finding decide `ok` or `nicht ok` with one reason. A rejection is `ok` when the reason holds.
3. No new findings, except a bug the fixes themselves brought in; name it `N1`, `N2`.
4. Never change code. Write `.review/re-review.md`:

```markdown
# Re-Review

- R1 · ok
- R2 · nicht ok · <reason>
```

## 5 · Close (writer)

1. Show the user a table: finding, severity, result (`behoben`, `abgelehnt`, `ok`, `nicht ok`).
2. List every `nicht ok` and `N` point as open. Do not fix them; the user decides.
3. List the changed files, so the user can commit them.
4. Delete `.review/`.

## End of each step

Tell the user the next step and in which tool to call `/review-loop` (writer or reviewer). After step 5 the loop is over.
