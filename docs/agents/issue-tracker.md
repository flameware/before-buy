# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Repository changes from a ticket

Any repo change made in the course of resolving a ticket (a `wayfinder:task` doing real work, a plain issue fix, anything that touches tracked files) goes through **branch → PR → merge** — never a direct commit to `main`.

1. `git checkout -b <short-descriptive-name>` off `main`.
2. Commit only the files relevant to the ticket — leave unrelated pre-existing local changes alone.
3. `git push -u origin <branch>`, then `gh pr create` with a body linking the ticket it resolves.
4. Merge (`gh pr merge --squash`) once checks pass; if `git status` shows local `main` has diverged from `origin/main` afterward, reconcile by resetting/pulling — don't force-push over it.

   **Do not pass `--delete-branch`.** This repo has `delete_branch_on_merge` enabled, so GitHub deletes the head branch server-side on every merge — the flag is redundant, and in a worktree it actively breaks the merge. `--delete-branch` deletes the *local and* remote branch, and to delete the local one `gh` first checks out the base branch; `main` is already claimed by another worktree, so that checkout fails with `fatal: 'main' is already used by worktree at ...`. **`gh` aborts there, after the API merge has already gone through** — so the merge succeeds, the exit code is non-zero, and any cleanup after that point is silently skipped. Read that error as "local cleanup failed", never as "the merge failed": confirm with `gh pr view <n> --json state` before retrying anything.

5. Record the change: the ticket's resolution comment/close (see Wayfinding operations below) links the PR; if the change altered a documented decision or convention, update the relevant doc (`CONTEXT.md`, `docs/adr/`, or this file) too.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far. If resolving the ticket changed tracked files, that change went through its own branch → PR → merge (see "Repository changes from a ticket" above) — link the PR in the resolution comment.
