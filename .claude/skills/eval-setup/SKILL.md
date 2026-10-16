---
name: eval-setup
description: Builds the eval base of one prompt unit from its section in the project's eval plan, so that cases can be written and run - review file, corpus folder if needed, the unit in the eval runner, and tests for its checks. Call with the unit, e.g. /eval-setup cv_analysis.
disable-model-invocation: true
---

# Eval setup

Arguments: **$ARGUMENTS**. The first word is the unit, e.g. `cv_analysis`.

You build the base, not the cases. Writing cases and running them are separate steps.

## Find your way

- **Eval plan:** the document that says per unit what is tested (e.g. `docs/EVAL_PLAN.md`). The project's `CLAUDE.md` or `README.md` points to it.
- **Eval folder:** where the eval code and the units live (e.g. `backend/evals/`).
- **Example unit:** a unit in the eval folder that already has a review file and cases. If there is one, copy its structure. If there is none, follow the eval plan alone.

## Steps

1. **Check.**
   - The prompt unit must exist in the code. If not, stop: the prompt unit comes first.
   - The eval runner must exist (code that runs a unit's cases and checks them). If not, stop and say so: this skill adds a unit to a runner, it does not build one.
   - The unit must not have a review file yet. If it has, stop: the base is already there.
2. **Read.**
   - The unit's section in the eval plan: cases, gold fields, review questions, checks, threshold.
   - The parts of the plan about models and files.
   - The prompt unit: its request function and the schema of the answer.
   - The example unit, if there is one: its review file, one gold file, and where the runner names it.
3. **Show the plan** in a few lines: which files you create or change. Then go on.
4. **Review file.** Write `<eval folder>/<unit>/review.md` with these parts:
   - **Rules:** what the unit does, the case id format, every gold field with its meaning, what a real case looks like, the typical failures the checks must catch, when a case is too weak.
   - **Questions:** F1, F2, … from the review questions in the plan, one per line; the last one is the verdict (keep, change, remove).
   - **About all cases:** G1 missing scenarios, G2 too weak cases, G3 cases built the same way, G4 balance of typical, edge and hard cases.
   - **Results:** empty heading.
5. **Corpus.** Only if the plan names one for the unit (e.g. PDFs or screenshots): create the folder and the build script the plan describes. If the script needs a tool that is not installed, write it anyway and name the tool as open.
6. **Runner.** Add the unit wherever the runner lists units, and nowhere else:
   - how one case becomes a request, using the request function of the prompt unit
   - a type for its gold file and a function with the checks of the plan, easiest first
   - the threshold of the plan
   - the corpus folder, if the review needs it
7. **Tests.** For each check, one passing and one failing answer. No model call.
8. **Verify** with the project's type check, lint and test commands (README or `package.json`). Fix what fails.
9. **Report** to the user:
   - the files you created or changed
   - what is still open, e.g. a missing tool, or a judge if the plan names one
   - the next step: write the cases (in this project `/eval-samples <unit> 10`)

## Rules

- Follow the rules of the project (`CLAUDE.md`, `AGENTS.md`) and the style of the code already in the eval folder.
- Never change the prompt unit.
- Never write cases or gold files.
- Never run a review or a model run; they cost time or money.
- Take checks and threshold from the plan only. If the plan is unclear, ask the user instead of guessing.
- Do not commit.
