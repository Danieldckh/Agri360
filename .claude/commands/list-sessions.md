---
description: "Show all active worktree sessions and their branches"
---

# List Active Sessions

Show the status of all concurrent Claude sessions.

## Steps

1. Run `git worktree list` to show all active worktrees
2. Run `git branch -v` to show all branches with their latest commit
3. For each non-main branch, run `git log --oneline -3 <branch>` to show recent commits
4. Check which branches have been merged into main: `git branch --merged master`
5. Present as a formatted summary:

```
## Active Sessions

### [branch-name] — [merged/unmerged]
- Worktree: [path or "no worktree"]
- Last commit: [message] ([date])
- Recent changes:
  - [commit 1]
  - [commit 2]
  - [commit 3]
```

6. At the end, summarize: X active sessions, Y merged (ready to clean up), Z unmerged
