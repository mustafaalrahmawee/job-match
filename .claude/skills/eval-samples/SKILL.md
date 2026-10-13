---
name: eval-samples
description: Writes the example cases of a job-match eval unit with the sample-writer subagent and has glm-5.3 review them with pnpm evals review, in at most three rounds. Call with the unit and the number of new cases, e.g. /eval-samples coach_chat 10.
disable-model-invocation: true
---

# Eval samples

Arguments: **$ARGUMENTS**. The first word is the unit (a folder under `backend/evals/` with a `review.md`, e.g. `coach_chat`, `cv_analysis`, `match_analysis`), the second the number of new cases (default 10).

You only coordinate. You do not write cases and you do not review them, so the writer never grades its own work (EV-24, EV-25).

Review command, from `backend/`:

```bash
pnpm evals review <unit> [cases...]
```

It sends each case to glm-5.3, appends the answer to `backend/evals/<unit>/review.md`, and prints one line per case with round and verdict. It refuses a fourth round. A case takes about two minutes, so run it in the background.

## Steps

1. Check that `backend/evals/<unit>/review.md` exists. For `cv_analysis`, `job_extract` and `match_analysis`, check that `backend/evals/corpus/` holds the CVs or ads the unit needs; if not, stop and say so.
2. **Write.** Start the `sample-writer` subagent: "Write <n> new cases for unit <unit>." Note the case ids it reports.
3. **Review.** Run the review command with these ids.
4. **Sort by verdict:**
   - `keep`: the case is done.
   - `remove`: delete `backend/evals/<unit>/samples/<case>/` (and its corpus folder, if the writer made one).
   - `change` or `unclear`: the case goes into the next round.
5. **Next round.** If cases are left and the last round was 1 or 2, start `sample-writer`: "Revise these cases of unit <unit>: <ids>. The reviewer's remarks are in review.md." Then go back to step 3 with these ids.
6. **Limit.** After round 3, delete every case whose last verdict is not `keep`.
7. **Whole set.** Run `pnpm evals review <unit> --all`.
8. **Act on the whole set, once.** If the answer names a missing scenario (G1), a too-weak case (G2), cases built the same way (G3) or an imbalance (G4), start `sample-writer`: "Act on the latest 'About all cases' entry in review.md for unit <unit>: revise <ids> and write new cases for <gaps>." Name only cases with fewer than three rounds; the others stay as they are. Then take the ids it reports through steps 3 to 6 (revised cases continue their round count, new cases start at round 1), run step 7 again, and do not repeat this step.
9. **Report** to the user: one line per case with its final state (kept or removed) and the reason, then the last answer about all cases.

## Rules

- Never edit `review.md` or a `gold.json` yourself.
- If the command fails, show the error and stop.
