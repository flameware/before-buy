# LLM experiments

How to run paid API calls when you're comparing conditions — models, prompts, parameters, output modes.

Comparison work multiplies: conditions × repetitions × a grader call per run. A grid that looks like "just a few tests" is a hundred paid calls. Almost all of the waste is **re-measuring something already measured**, so the discipline is a ledger, not restraint.

## The ledger

The **ledger** is the append-only record of which cells you have measured and what came back. A **cell** is one condition combination (model × setting × case).

- **Read it before you run.** A cell already in the ledger is cited, not re-run — including baselines. Wanting the baseline "in the same run as the new cells" is the most common way this rule gets broken; cite the earlier number instead.
- **Write it as you go.** Redirect each run's output to a JSONL file (`> …/pass3.jsonl`) so a run that is interrupted still leaves its measurements behind.
- **Promote the verdict.** Working ledgers live in the scratchpad and die with the session. Numbers that justify a decision go in the issue comment and the ADR, which is where the next session reads them from.

## Order of work

1. **Declare the budget.** Before running: cells × repetitions × expected tokens → dollars. Tell the user in one line.
2. **Run the cheapest discriminating test first.** One control group often settles the question that a full grid was built to answer — here, three plain-text calls proved the garbling was path-specific, which the 4×5 grid had not.
3. **Build the grid only on what's still open** after step 2.
4. **Stop a cell when it's decided.** Unanimous and lopsided (5/5 in one direction) means the remaining repetitions buy nothing. Kill the running job.
5. **Report actual spend** when you report results.

## Reference

- **Grade with a cheap model.** Scoring output — counting typos, checking a format — is a reading task; `claude-haiku-4-5` or `claude-sonnet-5` does it. Reserve the expensive model for the thing under test.
- **Make repetitions a variable.** `RUNS=3 bun run --env-file=.env.local scripts/_probe.ts` lets you start small and widen only where the result is noisy.
- **Treat scripts as disposable and results as the artifact.** Name probe scripts `scripts/_<name>.ts`, run them from the repo root so `@/` paths resolve, and delete them once their numbers are in the ledger.
- **Widen the sample before believing a small difference.** Three runs per cell is enough to spot a 40%-vs-0% gap and not enough to rank 4% against 7%.

You are done when every cell you ran was absent from the ledger beforehand, and the actual spend is reported.
