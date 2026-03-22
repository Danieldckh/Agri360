---
description: "Merge a session's worktree branch back into main"
argument-hint: "<branch-name>"
---

# Merge Session Branch

Merge the branch `$ARGUMENTS` into the main branch.

## Steps

1. Run `git status` and `git branch` to see current state
2. If currently in a worktree, call `ExitWorktree` with action "keep" first
3. Switch to main: `git checkout master`
4. Pull latest: `git pull` (if remote exists, otherwise skip)
5. Merge the branch: `git merge --no-ff "$ARGUMENTS" -m "Merge session: $ARGUMENTS"`
6. If there are merge conflicts:
   - List the conflicting files
   - For each conflict, read both versions and resolve intelligently
   - Stage resolved files and complete the merge
7. After successful merge, report what was merged
8. Ask the user if they want to delete the branch and its worktree:
   - If yes: `git worktree remove` (if worktree exists) and `git branch -d "$ARGUMENTS"`
   - If no: leave them in place
