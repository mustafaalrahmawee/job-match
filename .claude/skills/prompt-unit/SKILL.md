---
name: prompt-unit
description: Builds one prompt unit under docs/app-prompting-anchor.md in two phases with two subagents, the prompt-writer (Opus 5.5) and the prompt-reviewer (Fable 5.1). Phase 1 fills and reviews the sheet docs/prompts/<unit>.md step by step, then pauses for the user; phase 2 assembles backend/src/prompts/<unit>.ts and reviews the whole prompt. Call with the unit, e.g. /prompt-unit match_analysis. Run it before /review-loop for the use case.
disable-model-invocation: true
---

# Prompt unit

Arguments: **$ARGUMENTS**. The first word is the unit: a row of the table in `docs/EVAL_PLAN.md` §5, e.g. `job_extract`, `match_analysis`, `coach_agent`, `interview_question`, `interview_grade`, `interview_report`, `cover_letter`. With `--check` after an existing unit (`coach_agent`, `cv_analysis`) the writer fills the sheet from the existing code, the reviewer checks sheet and code, and the code stays unchanged.

You only coordinate. You do not write the sheet or the prompt and you do not review them, so the writer never grades its own work. Never touch `backend/evals/`, never run `pnpm evals`, never send a request to a model yourself. Never commit.

## Steps

1. **Collect the context.** Read the row of the unit in `docs/EVAL_PLAN.md` §5 (model, effort, why) and its section in §4 (what the unit gets and returns). Find the use case in `docs/APP_IDEA.md`: row, stage, domain entities. List the existing units in `backend/src/prompts/`, their sheets in `docs/prompts/`, and the module that will call the new unit (`backend/src/modules/<domain>/`, if it exists). If the row in §5 is missing, stop and say so. If `docs/prompts/<unit>.md` already exists, stop and ask the user whether to continue from it.

### Phase 1: the sheet

2. **Sheet.** Start `prompt-writer` with the job `sheet`: the unit name, model and effort from §5, the use case row and the §4 section as text, the paths of the existing units and sheets, and for `--check` the path of the existing unit file.
3. **Review.** Start `prompt-reviewer` with the job `sheet`, the path of the sheet and the use case row. It returns findings `P1`, `P2`, … or `Keine Funde.`
4. **Round two.** If there are findings, start `prompt-writer` with the job `revision`, the path and the findings verbatim. Then start `prompt-reviewer` with the job `re-review`, the path and the writer's answer. No third round.
5. **Pause.** Show the user a table with finding, step, anchor rule and result (`behoben`, `abgelehnt`, `ok`, `nicht ok`), every `nicht ok` and `N` point as open, the Offene Punkte of the sheet one line each, and the path of the sheet. Stop and wait. Phase 2 starts only when the user says so; changes the user asks for go to the writer as a `revision`. For `--check`, skip to step 7 with the existing unit file.

### Phase 2: the code

6. **Assembly.** Start `prompt-writer` with the job `assembly` and the path of the sheet.
7. **Review.** Start `prompt-reviewer` with the job `code`, the paths of sheet and unit file and the use case row. With findings, one more round as in step 4. For `--check`, findings are reported, not fixed.
8. **Check the code.** From `backend/`, run `pnpm typecheck` and `pnpm lint`. Show failures and stop; the writer does not run commands.
9. **Report** to the user: the table as in step 5 for this phase, the paths of sheet and unit, and the hint that `/review-loop UC-xx` builds the code around it next.
10. **Handover.** When the user accepts the unit, start `prompt-writer` with the job `handover` and the path of the sheet.

## Rules

- The writer gets model and effort from the estimate table in `docs/EVAL_PLAN.md` §5 and writes them as constants; it never picks a model itself. A different choice is the user's call and goes into that table first.
- Both subagents read `docs/app-prompting-anchor.md` themselves; do not paraphrase the anchor in your prompts to them.
- At most two rounds per phase. What is still open after that goes to the user, who decides.
- The reviewer never changes files; the writer never changes anything outside `docs/prompts/<unit>.md` and `backend/src/prompts/<unit>.ts`.
- If a subagent asks a question that only the user can answer, pass it on and stop.
