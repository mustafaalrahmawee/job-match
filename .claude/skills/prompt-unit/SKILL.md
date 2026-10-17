---
name: prompt-unit
description: Writes one prompt unit in backend/src/prompts/<unit>.ts under docs/app-prompting-anchor.md with two subagents, the prompt-writer (Opus 5.5) and the prompt-reviewer (Fable 5.1), in at most two rounds. Call with the unit, e.g. /prompt-unit match_analysis. Run it before /review-loop for the use case.
disable-model-invocation: true
---

# Prompt unit

Arguments: **$ARGUMENTS**. The first word is the unit: a row of the table in `docs/EVAL_PLAN.md` §5, e.g. `job_extract`, `match_analysis`, `coach_agent`, `interview_question`, `interview_grade`, `interview_report`, `job_recommendation`, `cover_letter`. With `--check` after an existing unit (`coach_chat`, `cv_analysis`) only the review runs, nothing is written.

You only coordinate. You do not write the prompt and you do not review it, so the writer never grades its own work. Never touch `backend/evals/`, never run `pnpm evals`, never send a request to a model yourself. Never commit.

## Steps

1. **Collect the context.** Read the row of the unit in `docs/EVAL_PLAN.md` §5 (model, effort, why) and its section in §4 (what the unit gets and returns). Find the use case in `docs/APP_IDEA.md`: row, stage, domain entities. List the existing units in `backend/src/prompts/` and the module that will call the new one (`backend/src/modules/<domain>/`, if it exists). If the row in §5 is missing, stop and say so.
2. **Write.** Start the `prompt-writer` subagent with: the unit name, the model and effort from §5, the use case row and the §4 section as text, the paths of the existing units as patterns, and the output file `backend/src/prompts/<unit>.ts`. For `--check` skip this step.
3. **Review.** Start the `prompt-reviewer` subagent with the path of the unit file and the use case row. It returns a list of findings, `P1`, `P2`, …, each with the anchor rule it breaks, or `Keine Funde.`
4. **Round two.** If there are findings and this was round one, start `prompt-writer` with: the path of the unit and the reviewer's findings verbatim. It fixes or rejects each one with a reason. Then start `prompt-reviewer` once more with the path and the writer's answer; it marks each finding `ok` or `nicht ok` and adds a new finding only for a defect the fix brought in (`N1`, `N2`).
5. **Check the code.** From `backend/`, run `pnpm typecheck` and `pnpm lint`. Show failures and stop; the writer does not run commands.
6. **Report** to the user: a table with finding, anchor rule and result (`behoben`, `abgelehnt`, `ok`, `nicht ok`); every `nicht ok` and `N` point as open, the user decides; the path of the unit; and the hint that `/review-loop UC-xx` builds the code around it next.

## Rules

- The writer gets model and effort from the estimate table in `docs/EVAL_PLAN.md` §5 and writes them as constants; it never picks a model itself. A different choice is the user's call and goes into that table first.
- Both subagents read `docs/app-prompting-anchor.md` themselves; do not paraphrase the anchor in your prompts to them.
- The reviewer never changes files; the writer never changes anything outside `backend/src/prompts/<unit>.ts`.
- If a subagent asks a question that only the user can answer, pass it on and stop.
