---
description: "Remove stale worktrees and merged branches"
---

# Cleanup Sessions

Remove worktrees and branches that have been merged or are no longer needed.

## Steps

1. Run `git worktree list` to find all worktrees
2. Run `git branch --merged master` to find merged branches
3. For each merged branch (excluding master):
   - If it has a worktree, remove it: `git worktree remove <path>`
   - Delete the branch: `git branch -d <branch>`
   - Report: "Cleaned up: <branch>"
4. Run `git worktree prune` to clean stale worktree entries
5. Check for unmerged branches: `git branch --no-merged master`
   - For each, report: "Unmerged (keeping): <branch> — last commit: <message>"
6. Summary: X branches cleaned up, Y unmerged branches remaining
