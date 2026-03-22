# ProAgri CRM - Development Guidelines

## Session Isolation (MANDATORY - DO THIS FIRST)

This project supports multiple concurrent Claude Code sessions. To prevent sessions from overwriting each other's work, **every session MUST use a git worktree**.

### Before making ANY file changes:

1. **Call `EnterWorktree`** with a descriptive name based on your task
   - Example names: `fix-login-bug`, `add-employee-search`, `messaging-refactor`
   - If running `/runteam`, the command handles this automatically — do NOT enter a worktree yourself
2. All your edits happen in the isolated worktree — completely separate from other sessions
3. **Commit your work before finishing** with a descriptive commit message
4. Tell the user the **branch name** so they can merge it later

### Do NOT skip this step. If you edit files without entering a worktree first, you risk overwriting another session's work.

---

## Merging & Cleanup

- `/merge-session <branch-name>` — Merge a session's branch into main
- `/list-sessions` — Show all active worktree sessions
- `/cleanup-sessions` — Remove merged/stale worktrees

---

## Project Structure

- `/api/` — Node.js/Express backend (PostgreSQL)
- `/auth/` — Authentication pages (CSS + JS)
- `/ui/` — Main application UI (styles + app logic)
- `/employees/` — Employee management module
- `/messaging/` — Messaging/communication system
- `/my-view/` — Personal dashboard
- `/dev/` — Development utilities
- `/pages/` — Page-level views

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework, no build system)
- **Backend**: Express.js 5.1.0 on Node.js
- **Database**: PostgreSQL (via `pg` driver)
- **Auth**: JWT + bcrypt
- **File uploads**: Multer

---

## Ralph Loop

When running `/ralph-loop`, always set `max_iterations: 10`. Do not use unlimited (0) iterations.
