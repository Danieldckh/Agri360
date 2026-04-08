# Agri360 Claude Processes

This document defines how Claude Code is expected to approach work in this repository. The hook in `.claude/settings.json` injects a short reminder of § 1 into every user prompt — if you change the process here, update the hook message to match.

## § 1. Default development workflow

For any prompt that touches application code (frontend, backend, routes, migrations, components, CSS, etc.), Claude must follow this pipeline in order. No step may be skipped unless the prompt matches one of the exceptions in § 2.

### The pipeline

1. **Research** — dispatch the `researcher` agent to investigate the relevant part of the codebase. The researcher produces a written report: which files are involved, which functions/routes/components are touched, what conventions the existing code follows, and what assumptions must be verified. Read-only. No code is written in this step.

2. **Task list** — based on the research report, create an explicit task list using `TaskCreate`. Each task must name:
   - What is being changed
   - Which file(s) it lives in
   - Whether it is frontend or backend (or both)
   - Its dependency on other tasks (if any)
   This list is the contract for the next step. Do not skip straight to delegation without it.

3. **Delegate to dev agents** — hand the task list to `dev-frontend` and `dev-backend` in parallel where possible. Each agent owns only the files in its lane. The task descriptions passed to the agents must be self-contained (they don't see this conversation). Update tasks to `in_progress` when dispatched and `completed` when the agent returns clean.

4. **Check on localhost** — before deploying, start the API locally (`cd api && npm start`, runs on :3001 serving the static frontend from the repo root) and open the affected page(s) in a browser via the Playwright MCP. Exercise the new/changed behavior end-to-end: navigate to the page, click through the flow, hover tooltips, confirm any DB writes took effect, and confirm nothing adjacent looks broken. If issues surface, re-dispatch the relevant dev agent with a focused fix prompt and re-check. Stop the background API server before moving on. Only proceed to deploy once the localhost check is clean.

5. **Merge, commit, and push — let Coolify auto-deploy** — once the localhost check is clean:
   - If any work was done in a git worktree, merge it back into `master` first (`git checkout master && git merge <branch>`). Do not leave worktrees dangling.
   - Stage the affected files explicitly by name (no `git add -A` / `git add .`, per the safety rules in CLAUDE.md).
   - Commit with a HEREDOC message following the `Co-Authored-By: Claude Opus 4.6 (1M context)` footer convention used in this repo.
   - `git push origin master`. Coolify is configured to auto-deploy on push to master — no explicit API trigger is needed.
   - Do NOT dispatch the `coolify-dev` agent for routine deploys. Only invoke it when you need to modify deployment config (Dockerfile, env vars, Coolify settings) or when the auto-deploy fails and you need to manually re-trigger or inspect the deploy.
   - Confirm the push succeeded and report the commit SHA to the user so they can watch the auto-deploy land.

### Why this shape

- **Research before planning** prevents task lists built on wrong assumptions about where code lives or how it connects.
- **Task list before delegation** gives the user a checkpoint to catch scope creep or misunderstanding before any code is written.
- **Localhost check before deploy** catches obviously-broken UI changes (fixed-width CSS on variable-width content, misplaced popups, missing data bindings) that syntax checks miss — without burning the user's time verifying in production.
- **Auto-deploy on push to master** removes an unnecessary agent hop — every routine deploy was going through `coolify-dev` just to make an HTTP POST that Coolify would have done anyway when it saw the push. The `coolify-dev` agent stays reserved for its real job: editing `Dockerfile` / `api/db.js` schema / env vars, and handling deploy failures.

## § 2. Exceptions — when to skip the pipeline

Follow the pipeline by default. Skip it **only** when the prompt is clearly one of:

1. **Question or status check** — "what does X do?", "is Y still broken?", "show me Z". Answer inline.
2. **Docs / spec / process file edit** — editing anything under `docs/`, `CLAUDE.md`, `.claude/`, or `README*`. Edit inline.
3. **Explicit "do this inline" instruction** — user says "just do it", "inline", "don't dispatch", etc.
4. **Research-only / audit** — user wants a written report, not code changes. Dispatch the `researcher` agent alone and return its findings.
5. **Trivial cosmetic single-file edit** — e.g. "change this padding to 12px", "rename this variable", "fix this typo". One file, obviously safe, no cross-cutting impact. Edit inline.

When in doubt, run the pipeline. The cost of over-process on a small task is lower than the cost of shipping an un-verified change.

## § 3. Agent lane rules

| Agent | Owns | Never touches |
|---|---|---|
| `researcher` | Read-only reports, inventories, traces | Writes code |
| `dev-frontend` | `pages/`, `ui/`, `index.html`, static assets | `api/`, `api/db.js` schema |
| `dev-backend` | `api/routes/`, `api/services/`, `api/utils.js`, auth middleware | `pages/`, `ui/` |
| `coolify-dev` | `api/db.js` schema, `Dockerfile`, Coolify API calls, env vars, production deploys | Feature code |
| `dev-reviewer` | Review output, findings report, Playwright runs | Writes feature code |
| `dev-orchestrator` | Coordinates the pipeline end-to-end (optional convenience) | Owns no files directly |

`dev-orchestrator` may still be used for complex multi-agent coordination, but it must itself follow this pipeline — it is not a shortcut around research and task-listing.

## § 4. Standing user preferences

These override default behavior regardless of which step you're in:

- **Skip all checkpoints during `/runteam`** — run phases continuously without asking.
- **Absolute dates in memory** — convert "Thursday" → "2026-04-09" style when writing memories.

## § 5. Changing this process

If the process needs to change, the user will say so explicitly. When editing this file:

1. Update § 1 and/or § 2 to reflect the new rules.
2. Update the `UserPromptSubmit` hook command in `.claude/settings.json` so its echoed reminder matches the new § 1 summary.
3. Commit both changes together — drift between this doc and the hook is the single most common way the process gets silently broken.
