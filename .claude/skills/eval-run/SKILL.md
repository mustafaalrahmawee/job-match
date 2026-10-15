---
name: eval-run
description: Runs the example cases of a job-match eval unit with pnpm evals run (cost estimate first, batch only after the user agrees) and grades them with pnpm evals check. Call with the unit and a new fassung name, optionally a model and an effort, e.g. /eval-run <unit> <fassung> [model] [effort].
disable-model-invocation: true
---

# Eval run

Arguments: **$ARGUMENTS**. The first word is the unit (a folder under `backend/evals/` with `samples/`), the second the fassung, a new name for this run. Everything after it goes to the run command unchanged: a model, an effort and any flag the unit's run command knows. Without them the unit's own model and effort are used.

Name the fassung after what it tests: prompt version, model and effort, e.g. `v1-<model>-<effort>`. A second run with the same setting gets `-2`.

Commands, from `backend/`:

```bash
pnpm evals run <unit> <fassung> [model] [effort] [flags]
pnpm evals run <unit> <fassung> [model] [effort] [flags] --yes
pnpm evals check <unit> <fassung>
```

Without `--yes` the run command only counts tokens and prints the estimated cost; nothing is sent. With `--yes` it sends a Message Batch, waits for it (a few minutes, so run it in the background) and writes `backend/evals/<unit>/runs/<fassung>/`. The check command writes `check.txt` there and prints one line per case.

## Steps

1. Check that `backend/evals/<unit>/samples/` exists. If `runs/<fassung>/meta.json` exists, do not start a new run: if it has `cost_usd`, go to step 5; if not, the batch is still open, so run the command with `--yes` to fetch it and go to step 5.
2. **Estimate.** Run the command without `--yes` and show its two lines: requests with model and effort, and the estimated cost.
3. **Ask.** Ask the user whether to start the batch for this cost. The estimate assumes a fixed number of output tokens per answer; if the unit has earlier runs, also say what the closest one really cost (`cost_usd` in its `meta.json`). Stop if the user says no.
4. **Run.** Run the same command with `--yes` and wait until it reports the answers written and the cost.
5. **Check.** Run the check command.
6. **Compare.** Pick the reference run: the one named under "Chosen" in the unit's section in `docs/EVAL_PLAN.md` §4, otherwise the newest earlier run in `runs/`. Compare average words and output tokens from both `metrics.tsv`. Skip this step if there is no earlier run.
7. **Report** to the user:
   - cases right in all three runs, threshold, verdict, cost
   - every failing case with its check and value as `check.txt` shows it
   - the comparison from step 6 in a small table
   - what the failures have in common, in one or two sentences

## Rules

- Never run with `--yes` before the user has agreed to the estimate in this conversation.
- Never delete or overwrite a run folder; a new attempt gets a new fassung.
- Never edit a prompt, a `gold.json` or `review.md` to make a run pass.
- Do not commit; name the new folder so the user can commit it.
- If a command fails, for example because the unit is not known to `pnpm evals run` or `pnpm evals check` yet, show the error and stop.
