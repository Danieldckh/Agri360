# Agent Teams — Master Reference Guide

> **Audience**: Future Claude Code sessions working in this project.
> **Purpose**: Fast, actionable reference for deciding whether to use an agent team, how to structure one, and how to avoid known pitfalls.
> **Source of truth**: [https://code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams)
> **Claude Code version required**: v2.1.32+
> **Status**: Experimental — already enabled in `.claude/settings.local.json` via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

---

## How to use this guide

This file is a **reference**, not a script. Skim the decision tree first, then jump to the section you need. The sections are ordered roughly from "deciding" to "running" to "finishing" a team.

### Decision tree: should I use an agent team right now?

```
Does the task genuinely benefit from multiple independent investigations
or independent file-ownership workstreams?
│
├── NO → Don't use a team. Use a single session or a subagent.
│        (Teams multiply token cost ~3–6x. Coordination overhead is real.)
│
└── YES
    │
    ├── Do the workers need to talk to each other or challenge each other?
    │   │
    │   ├── NO → Use subagents. They report back to the main agent only.
    │   │        Cheaper, simpler, lower coordination cost.
    │   │
    │   └── YES → Use an agent team.
    │
    └── Can the work be split so no two workers edit the same file?
        │
        ├── NO → Reconsider. Same-file edits cause overwrites in teams.
        │        Restructure the task, or use sequential work.
        │
        └── YES → Proceed. Define file ownership explicitly in the spawn prompt.
```

### When the answer is clearly YES

Strong use cases (from official docs):
- **Research and review** — parallel investigation of different aspects
- **New modules or features** — each teammate owns separate files
- **Debugging with competing hypotheses** — adversarial investigators
- **Cross-layer coordination** — frontend + backend + tests owned separately

### When the answer is clearly NO

- Sequential tasks with many dependencies
- Same-file edits (causes overwrites)
- Routine / simple tasks where one session suffices
- Tasks where coordination overhead > parallel benefit

---

## Table of Contents

1. [What Agent Teams Are](#1-what-agent-teams-are)
2. [Agent Teams vs Subagents](#2-agent-teams-vs-subagents)
3. [Enabling Agent Teams](#3-enabling-agent-teams)
4. [Architecture](#4-architecture)
5. [Starting a Team](#5-starting-a-team)
6. [Subagent Definitions as Teammates](#6-subagent-definitions-as-teammates)
7. [Display Modes](#7-display-modes)
8. [Controlling the Team](#8-controlling-the-team)
9. [Task System](#9-task-system)
10. [Communication & Messaging](#10-communication--messaging)
11. [Permissions](#11-permissions)
12. [Hooks & Quality Gates](#12-hooks--quality-gates)
13. [Best Practices](#13-best-practices)
14. [Anti-Patterns](#14-anti-patterns)
15. [Use Case Examples](#15-use-case-examples)
16. [Troubleshooting](#16-troubleshooting)
17. [Known Limitations](#17-known-limitations)
18. [Quick Reference Cheat Sheet](#18-quick-reference-cheat-sheet)

---

## 1. What Agent Teams Are

An agent team lets one Claude Code session (the **team lead**) coordinate multiple other Claude Code sessions (**teammates**) working together on a shared task. Each teammate is a **full, independent Claude Code instance** with its own context window.

### Core properties

- **Each teammate is a separate Claude Code session** — full project context, full tool access, independent conversation
- **Teammates share a task list** but have **separate context windows**
- **The lead's conversation history does NOT carry over** to teammates — you must brief them in the spawn prompt
- **Teammates auto-load project context**: CLAUDE.md, MCP servers, skills, project settings
- **Teammates can message each other directly** — not just report back to the lead
- **You can talk to any teammate directly** — not just through the lead

### How a team gets started

Two paths, both require your explicit approval:

1. **User-requested**: you describe a task and explicitly ask for an agent team
2. **Claude-proposed**: Claude suggests a team for a task that would benefit from parallel work; you confirm before it proceeds

Claude **never** creates a team without user approval.

---

## 2. Agent Teams vs Subagents

Both parallelize work, but the mechanism differs. Choose based on **whether workers need to communicate with each other**.

|                | Subagents                                     | Agent Teams                                      |
|:---------------|:----------------------------------------------|:-------------------------------------------------|
| **Context**    | Own context window; results return to caller  | Own context window; fully independent            |
| **Communication** | Report back to main agent only              | Teammates message each other directly            |
| **Coordination** | Main agent manages all work                 | Shared task list with self-coordination          |
| **Best for**   | Focused tasks where only the result matters   | Complex work requiring discussion & collaboration |
| **Token cost** | Lower — results summarized back to main       | Higher — each teammate is a separate Claude      |
| **User interaction** | Only with main agent                    | Can interact with any teammate directly          |
| **Lifetime**   | Short-lived, single purpose                   | Long-lived, multi-task                           |

**Rule of thumb**:
- **Subagents** → quick, focused workers that report back. Use for research sweeps, verification, parallel lookups.
- **Agent teams** → teammates that need to share findings, challenge each other, and coordinate work independently. Use for cross-layer features, adversarial debugging, multi-reviewer PRs.

---

## 3. Enabling Agent Teams

> **Already enabled in this project** via `.claude/settings.local.json`.

To enable elsewhere, set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in any of:

### Option A: Project-local settings (per-user, gitignored)

`.claude/settings.local.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Option B: User-global settings

`~/.claude/settings.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Option C: Shell environment

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

> **Restart required**: env vars are read at Claude Code startup. Changing the setting does nothing until you restart.

---

## 4. Architecture

An agent team has four components:

| Component     | Role                                                                                       |
|:--------------|:-------------------------------------------------------------------------------------------|
| **Team Lead** | The Claude Code session that creates the team, spawns teammates, and coordinates work     |
| **Teammates** | Separate Claude Code instances, each working on assigned tasks                             |
| **Task List** | Shared list of work items that teammates claim and complete                                |
| **Mailbox**   | Messaging system for communication between the lead and teammates, and teammates to each other |

### Storage locations

| Data             | Path                                          |
|:-----------------|:----------------------------------------------|
| Team config      | `~/.claude/teams/{team-name}/config.json`     |
| Task list        | `~/.claude/tasks/{team-name}/`                |

The team config holds runtime state — session IDs, tmux pane IDs, a `members` array with each teammate's **name**, **agent ID**, and **agent type**. Teammates can read this file to discover other team members.

> **Critical**: Do NOT edit or pre-author the team config by hand. Claude Code overwrites it on the next state update.

> **No project-level team config exists.** A file like `.claude/teams/teams.json` in a project directory is **not** recognized as configuration — Claude treats it as an ordinary file. Only `~/.claude/teams/` is real.

### Lead vs teammate: who does what

| Capability                                | Lead | Teammate |
|:------------------------------------------|:----:|:--------:|
| Create the team                           |  Y   |    N     |
| Spawn teammates                           |  Y   |    N     |
| Assign tasks                              |  Y   |  Y (self-claim) |
| Message other members                     |  Y   |    Y     |
| Approve/reject teammate plans             |  Y   |    N     |
| Clean up the team                         |  Y   |  **NEVER** |
| Spawn nested teams                        |  N   |    N     |

---

## 5. Starting a Team

Tell Claude in **natural language**. Describe the task, the structure, and (optionally) team size and models.

### Minimum viable spawn prompt

```
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Create an agent team to explore this from different angles:
one teammate on UX, one on technical architecture, one playing devil's advocate.
```

### What Claude does

1. Creates a team with a shared task list
2. Spawns one teammate per role
3. Teammates work independently (may message each other)
4. Lead synthesizes findings as they come in
5. Team is cleaned up when finished (lead runs cleanup)

### Specifying team size and models

```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

### Giving teammates predictable names

The lead assigns each teammate a name at spawn time. To get names **you can reference in later prompts**, specify them in the spawn instruction:

```
Create a team with three teammates named "backend", "frontend", and "tests".
Backend owns api/routes/notifications.js. Frontend owns notifications/js/ and
notifications/css/. Tests owns all __tests__ files.
```

This lets you later say "ask **frontend** to add a loading state" without ambiguity.

---

## 6. Subagent Definitions as Teammates

**This is a powerful pattern**: instead of writing the full role from scratch in the spawn prompt, reference a **subagent definition** by name. The teammate will honor that definition's configuration.

### How to use

```
Spawn a teammate using the security-reviewer agent type to audit the auth module.
```

Claude spawns a teammate that loads the `security-reviewer` subagent definition (from any scope: project, user, plugin, or CLI-defined).

### What the subagent definition contributes

When a subagent definition is used as a teammate:

| Field                    | Applied? | Notes                                                    |
|:-------------------------|:--------:|:---------------------------------------------------------|
| `tools` allowlist        |   Yes    | Teammate is restricted to these tools                    |
| `model`                  |   Yes    | Teammate runs on the specified model                     |
| Body (system prompt)     |   Yes    | **Appended** to the teammate's system prompt, not replacing it |
| `skills` frontmatter     | **NO**   | Teammate loads skills from project/user settings instead |
| `mcpServers` frontmatter | **NO**   | Teammate loads MCP servers from project/user settings    |

### Team coordination tools are always available

Regardless of what the `tools` allowlist restricts, teammates **always** have access to:
- `SendMessage` — for inter-teammate and teammate-to-lead messaging
- Task management tools — create, claim, update, complete tasks

You do not need to add these to a subagent definition's `tools` list.

### Why this matters

Define a role **once** in a subagent file, then reuse it:
- As a delegated subagent in a normal session
- As an agent team teammate

No duplication of prompts, tools, or model choice.

---

## 7. Display Modes

### In-process mode (default, works anywhere)

All teammates run inside the main terminal. Use keyboard shortcuts to navigate between them.

| Action                          | Shortcut                          |
|:--------------------------------|:----------------------------------|
| Cycle through teammates         | `Shift+Down`                      |
| View teammate session           | `Enter`                           |
| Interrupt teammate's turn       | `Escape`                          |
| Toggle task list                | `Ctrl+T`                          |
| Wrap to lead after last teammate| `Shift+Down`                      |

Works in **any terminal** — no setup required.

### Split-pane mode

Each teammate gets its own pane. See all output simultaneously.

**Requires**: `tmux` OR iTerm2 with the [`it2` CLI](https://github.com/mkusaka/it2).

> `tmux` traditionally works best on macOS. Using `tmux -CC` in iTerm2 is the suggested entry point.
>
> **Not supported**: VS Code terminal, Windows Terminal, Ghostty.

### Configuration

**Global config** — `~/.claude.json`:
```json
{
  "teammateMode": "in-process"
}
```

Values:
- `"auto"` (default) — split panes if already inside a tmux session, otherwise in-process
- `"in-process"` — force single-terminal mode
- `"tmux"` — force split panes, auto-detecting tmux vs iTerm2

**Per-session override**:
```bash
claude --teammate-mode in-process
```

### Installing tmux / iTerm2 integrations

- **tmux**: package manager install — [tmux wiki](https://github.com/tmux/tmux/wiki/Installing)
- **iTerm2**: install [`it2` CLI](https://github.com/mkusaka/it2), then enable in **iTerm2 → Settings → General → Magic → Enable Python API**

---

## 8. Controlling the Team

All control happens through **natural language to the lead**.

### Require plan approval

For complex or risky work, force teammates to plan before implementing:

```
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

**Flow**:
1. Teammate works in **read-only plan mode**
2. When done planning → sends a plan approval request to the lead
3. Lead reviews, **approves** OR **rejects with feedback**
4. If rejected → teammate revises in plan mode and resubmits
5. If approved → teammate exits plan mode, begins implementation

**Influence the lead's approval criteria** in your original prompt:
```
Only approve plans that include test coverage
Reject plans that modify the database schema
Reject plans that touch more than 5 files
```

The lead makes approval decisions autonomously based on these criteria.

### Talk to teammates directly

Each teammate is a full independent session. You can:
- Give additional instructions mid-task
- Ask follow-up questions
- Redirect their approach

**In-process**: `Shift+Down` to cycle, then type
**Split-pane**: click into the pane

### Shut down a teammate gracefully

```
Ask the researcher teammate to shut down
```

The teammate can **approve** (exits gracefully) or **reject with explanation** (if still mid-work).

### Clean up the team

```
Clean up the team
```

> **Critical**: Always use the **lead** to clean up. Teammates should NEVER run cleanup — their team context may not resolve correctly, leaving resources in an inconsistent state.

> **Shut down all teammates first**. Cleanup fails if any teammates are still running.

---

## 9. Task System

The shared task list is the coordination mechanism. The lead creates tasks; teammates work them.

### Task states

| State            | Description                          |
|:-----------------|:-------------------------------------|
| **Pending**      | Not yet started                      |
| **In Progress**  | Claimed by a teammate                |
| **Completed**    | Work finished                        |

### Dependencies

- Tasks can depend on other tasks
- A pending task with **unresolved dependencies cannot be claimed** until dependencies complete
- When a teammate completes a blocking task, dependents unblock **automatically**

### Assignment modes

1. **Lead-assigned** — tell the lead which task goes to which teammate
2. **Self-claim** — after finishing a task, a teammate picks the next unassigned, unblocked task

> Task claiming uses **file locking** to prevent race conditions when multiple teammates try to claim the same task simultaneously.

### Sizing tasks

| Size         | Problem                                                                              |
|:-------------|:-------------------------------------------------------------------------------------|
| **Too small** | Coordination overhead exceeds the benefit                                           |
| **Too large** | Teammates work too long without check-ins, increasing wasted-effort risk            |
| **Just right** | Self-contained units with a clear deliverable (a function, a test file, a review) |

**Guideline**: Aim for **5–6 tasks per teammate**. Keeps everyone productive without excessive context switching.

If the lead isn't creating enough tasks, say:
```
Split the work into smaller tasks so each teammate has 5-6 things to do
```

### Task status can lag (known issue)

Teammates sometimes fail to mark tasks completed, blocking dependents. If a task seems stuck:
1. Verify the work is actually done (read their output)
2. Manually update the task, OR
3. Tell the lead to nudge the teammate

---

## 10. Communication & Messaging

### How teammates share information

| Mechanism                    | Description                                                           |
|:-----------------------------|:----------------------------------------------------------------------|
| **Automatic message delivery** | Messages delivered automatically — lead doesn't need to poll        |
| **Idle notifications**       | When a teammate finishes and stops, they auto-notify the lead         |
| **Shared task list**         | All agents see task status and claim available work                   |

### Message types

| Type          | Description                                             | Cost note                           |
|:--------------|:--------------------------------------------------------|:------------------------------------|
| **message**   | Send to one specific teammate                           | Standard, cheap                     |
| **broadcast** | Send to all teammates simultaneously                    | Costs scale with team size — use sparingly |

### Naming convention

The lead assigns teammate names at spawn. Any teammate can message any other **by name**. For predictable addressing, specify names in the spawn prompt (see section 5).

### Context that IS shared at spawn

- CLAUDE.md (project conventions)
- MCP servers
- Skills
- The spawn prompt the lead writes for this teammate

### Context that is NOT shared at spawn

- **The lead's conversation history** (biggest gotcha)
- Prior teammate discussions (unless messaged)
- Uncommitted state from the lead's session context

> **Implication**: Write spawn prompts as if briefing a new colleague who just walked in — include all relevant files, decisions already made, constraints, and what "done" looks like.

---

## 11. Permissions

- Teammates start with the **lead's permission settings**
- If the lead runs with `--dangerously-skip-permissions`, all teammates do too
- You **can** change individual teammate modes after spawning
- You **cannot** set per-teammate modes at spawn time
- Teammate permission requests bubble up to the lead — which can create friction

**Tip**: Pre-approve common operations in your permission settings **before** spawning teammates, to reduce interruptions.

---

## 12. Hooks & Quality Gates

Use hooks to enforce rules when teammates finish work or tasks change state. See [hooks docs](https://code.claude.com/docs/en/hooks).

| Hook             | When it fires                              | Exit code 2 effect                       |
|:-----------------|:-------------------------------------------|:-----------------------------------------|
| `TeammateIdle`   | Teammate is about to go idle               | Sends feedback, keeps teammate working  |
| `TaskCreated`    | A task is being created                    | Prevents creation, sends feedback       |
| `TaskCompleted`  | A task is being marked complete            | Prevents completion, sends feedback     |

**Example use**: a `TaskCompleted` hook that runs tests and blocks completion if they fail.

---

## 13. Best Practices

### 1. Brief teammates thoroughly

Teammates don't inherit the lead's conversation history. The spawn prompt is the **only** context they get beyond CLAUDE.md and project settings.

**Weak prompt**:
```
Review the auth module for security issues.
```

**Strong prompt**:
```
Spawn a security reviewer teammate with the prompt: "Review the authentication
module at src/auth/ for security vulnerabilities. Focus on token handling,
session management, and input validation. The app uses JWT tokens stored in
httpOnly cookies. Report any issues with severity ratings."
```

### 2. Right-size the team

- Start with **3–5 teammates**
- 5–6 tasks per teammate keeps everyone productive
- Scale up only when work **genuinely** benefits from parallelism
- **Three focused teammates often outperform five scattered ones**

### 3. Prevent file conflicts

Two teammates editing the same file → overwrites. **Break work so each teammate owns different files**. State ownership explicitly in the spawn prompt.

### 4. Wait for teammates to finish

If the lead starts implementing instead of delegating, say:
```
Wait for your teammates to complete their tasks before proceeding.
```

### 5. Start with research/review if new to teams

Lower coordination risk than parallel implementation:
- Reviewing a PR
- Researching a library
- Investigating a bug

### 6. Monitor and steer

- Check in on progress
- Redirect approaches that aren't working
- Synthesize findings as they come in
- **Don't let a team run unattended for too long** — wasted effort compounds

### 7. Use predictable names

Pre-specify teammate names so you can address them later without ambiguity (see section 5).

### 8. Define ownership boundaries explicitly

Don't assume the lead will figure out file ownership. State it:
```
Backend owns api/routes/X.js and migrations.
Frontend owns module/js/ and module/css/.
Tests owns all __tests__ files.
No teammate should touch files outside their ownership.
```

---

## 14. Anti-Patterns

Things to **actively avoid**.

### Anti-pattern: Using a team for same-file work
**Problem**: Overwrites are inevitable.
**Fix**: Either restructure the work so each teammate owns a different file, or use sequential single-session work.

### Anti-pattern: Vague spawn prompts
**Problem**: Teammate wastes tokens rediscovering context the lead already knows.
**Fix**: Inline all relevant files, decisions, constraints, and success criteria.

### Anti-pattern: Using a team for trivial work
**Problem**: Teams cost ~3–6x tokens. A team for a task that fits in one session is pure overhead.
**Fix**: Use a single session for routine work; reserve teams for parallel investigations and cross-layer features.

### Anti-pattern: Letting teammates run cleanup
**Problem**: Teammate team context may not resolve correctly — corrupts team state.
**Fix**: Only the lead runs cleanup. Shut down teammates first, then lead runs cleanup.

### Anti-pattern: Editing `~/.claude/teams/{team}/config.json` by hand
**Problem**: Claude Code overwrites it on the next state update — your edits vanish.
**Fix**: Never edit it. To change team shape, ask the lead to spawn or remove teammates.

### Anti-pattern: Creating `.claude/teams/teams.json` in a project
**Problem**: Project-level team configs **don't exist**. Claude treats the file as ordinary content.
**Fix**: Use subagent definitions for reusable roles (section 6).

### Anti-pattern: Assuming `skills` frontmatter works on subagent-as-teammate
**Problem**: The `skills` field in a subagent definition is **ignored** when that definition is used as a teammate. Same for `mcpServers`.
**Fix**: Teammates load skills/MCP from project+user settings. Don't rely on per-subagent skill scoping.

### Anti-pattern: Broadcast-heavy communication
**Problem**: Broadcast cost scales with team size; noisy conversations burn tokens fast.
**Fix**: Prefer direct `message` to one teammate. Reserve `broadcast` for truly team-wide announcements.

### Anti-pattern: Unattended teams
**Problem**: Teams can drift from the goal. Wasted teammate effort is wasted $ and time.
**Fix**: Monitor regularly. Steer when approaches aren't working. Shut down dead branches.

### Anti-pattern: Spawning before enabling flag
**Problem**: Without `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, team creation silently falls back to non-team behavior or errors.
**Fix**: Verify enablement, and **restart Claude Code** after toggling the flag.

### Anti-pattern: Team + active git worktrees without planning
**Problem**: If each teammate needs file isolation AND the project uses worktrees, you get a combinatorial mess.
**Fix**: Either use a team (file ownership by path) OR worktrees (full working-copy isolation), not both, unless you've explicitly planned the interaction.

---

## 15. Use Case Examples

### Parallel code review (3 reviewers)

```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

**Why it works**: Each reviewer applies a different filter to the same PR. The lead synthesizes across all three, avoiding the "single reviewer gravitates to one issue type" failure mode.

### Competing-hypothesis debugging (adversarial)

```
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses. Have them talk
to each other to try to disprove each other's theories, like a scientific
debate. Update the findings doc with whatever consensus emerges.
```

**Why it works**: Sequential investigation anchors on the first plausible theory. Parallel adversarial investigation forces each theory to survive active attempts to disprove it. The surviving theory is more likely the actual root cause.

### Cross-layer feature build (file ownership)

```
Create an agent team to build the new notifications feature:
- Backend teammate: owns api/routes/notifications.js and migrations
- Frontend teammate: owns notifications/js/ and notifications/css/
- Test teammate: owns all test files
Have them coordinate on the API contract first, then build in parallel.
No teammate should touch files outside their ownership.
```

**Why it works**: File ownership prevents overwrites. The "API contract first" step forces early coordination on the shared interface before independent parallel work.

### Multi-angle research

```
I'm designing a CLI tool that tracks TODO comments. Create an agent team to
explore this from different angles: one teammate on UX, one on technical
architecture, one playing devil's advocate.
```

**Why it works**: Roles are **orthogonal**. No teammate is blocked waiting for another's output.

---

## 16. Troubleshooting

### Teammates not appearing

| Check                 | Solution                                                              |
|:----------------------|:----------------------------------------------------------------------|
| In-process mode       | Press `Shift+Down` — teammates may be running but not visible         |
| Task complexity       | Claude only spawns teams for complex tasks. Ask explicitly if needed  |
| Split pane setup      | `which tmux` — verify installed                                       |
| iTerm2                | Verify `it2` CLI installed + Python API enabled                       |
| Flag enabled?         | `echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` — should be `1`          |
| Claude Code restarted?| Env var changes require restart                                       |

### Too many permission prompts

Teammate permission requests bubble to the lead. Pre-approve common operations in permission settings **before** spawning.

### Teammates stopping on errors

1. Check their output (`Shift+Down` in in-process, click pane in split)
2. Give additional instructions directly, OR
3. Spawn a replacement teammate

### Lead shuts down before work is done

Lead may decide the team is finished prematurely. Tell it:
```
Keep going — wait for all teammates to finish before wrapping up.
```

If the lead is doing work instead of delegating:
```
Wait for your teammates to complete their tasks before proceeding.
```

### Orphaned tmux sessions

```bash
tmux ls
tmux kill-session -t <session-name>
```

### Task appears stuck

Likely cause: teammate failed to mark it completed. Either:
1. Manually update the task status, OR
2. Tell the lead to nudge the teammate to confirm completion

---

## 17. Known Limitations

| Limitation                          | Details                                                                                    |
|:------------------------------------|:-------------------------------------------------------------------------------------------|
| **No session resumption**           | `/resume` and `/rewind` do not restore in-process teammates. Spawn new ones after resume.  |
| **Task status can lag**             | Teammates sometimes fail to mark tasks completed, blocking dependents. Manually nudge.     |
| **Slow shutdown**                   | Teammates finish current request/tool call before shutting down.                           |
| **One team per session**            | Clean up the current team before starting a new one.                                       |
| **No nested teams**                 | Teammates cannot spawn their own teams or sub-teammates. Only the lead manages the team.   |
| **Fixed lead**                      | The session that creates the team is lead for its lifetime. No promotion/transfer.         |
| **Permissions at spawn**            | All teammates start with lead's mode. Change individually after spawning.                  |
| **Split panes limited**             | Not supported in VS Code terminal, Windows Terminal, or Ghostty.                           |
| **No project-level team config**    | `~/.claude/teams/` is the only recognized location. Project-level configs are ignored.    |
| **Subagent `skills`/`mcpServers` ignored on teammates** | Teammates load from project+user settings, not subagent frontmatter.     |

---

## 18. Quick Reference Cheat Sheet

### Keyboard shortcuts (in-process mode)

| Shortcut       | Action                          |
|:---------------|:--------------------------------|
| `Shift+Down`   | Cycle through teammates         |
| `Enter`        | View teammate session           |
| `Escape`       | Interrupt teammate's turn       |
| `Ctrl+T`       | Toggle task list                |

### Common natural-language commands (to the lead)

```
Create a team with 3 teammates to [task description]
Create a team with teammates named "X", "Y", "Z" to [task]
Use Sonnet for each teammate
Spawn a teammate using the [subagent-name] agent type
Require plan approval before they make changes
Only approve plans that include test coverage
Wait for your teammates to complete their tasks
Ask the [name] teammate to shut down
Clean up the team
```

### Settings quick reference

| Setting                | File                              | Value                                                      |
|:-----------------------|:----------------------------------|:-----------------------------------------------------------|
| Enable agent teams     | `.claude/settings.local.json`     | `"env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }`   |
| Display mode           | `~/.claude.json`                  | `"teammateMode": "in-process" \| "tmux" \| "auto"`          |
| CLI override           | —                                 | `claude --teammate-mode in-process`                        |

### Token cost awareness

| Team size      | Rough cost multiplier | Notes                                          |
|:---------------|:----------------------|:-----------------------------------------------|
| 1 (no team)    | 1x                    | Baseline                                       |
| 3 teammates    | ~4x                   | Lead + 3, each with own context                |
| 5 teammates    | ~6x                   | Diminishing returns beyond this                |

Each teammate has its own context window. Token usage scales **linearly** with active teammates. For research/review/new-feature work, extra tokens are usually worthwhile. For routine tasks, a single session is more cost-effective.

### File locations

| Data                | Path                                         |
|:--------------------|:---------------------------------------------|
| Team config         | `~/.claude/teams/{team-name}/config.json`   |
| Task list           | `~/.claude/tasks/{team-name}/`               |
| Project settings    | `.claude/settings.local.json`                |
| Global config       | `~/.claude.json`                             |

### Related docs

- Subagents: https://code.claude.com/docs/en/sub-agents
- Hooks: https://code.claude.com/docs/en/hooks
- Settings: https://code.claude.com/docs/en/settings
- Permissions: https://code.claude.com/docs/en/permissions
- Token costs: https://code.claude.com/docs/en/costs
- Interactive mode (task list): https://code.claude.com/docs/en/interactive-mode
- Git worktrees: https://code.claude.com/docs/en/common-workflows
- Agent teams (this page's source): https://code.claude.com/docs/en/agent-teams

---

## Appendix: Decision framework for future Claude

When a task arrives, before doing anything, answer these four questions:

1. **Is the task complex enough to benefit from parallelism?**
   - If it fits in a single focused session → single session.
   - Otherwise → continue.

2. **Can the work be split into genuinely independent units?**
   - If units have tight sequential dependencies → single session or sequential subagents.
   - Otherwise → continue.

3. **Do the workers need to talk to each other?**
   - No → subagents (cheaper, simpler).
   - Yes → agent team.

4. **Can file ownership be cleanly assigned so no two workers touch the same file?**
   - No → restructure or drop the team approach.
   - Yes → spawn the team with explicit ownership in the prompt.

If all four check out, spawn with:
- **Named teammates** (for later addressability)
- **Explicit file ownership** per teammate
- **Success criteria** per teammate (what "done" looks like)
- **Coordination point** if there's a shared interface (e.g., "agree on the API contract first, then build in parallel")
- **Plan approval gate** if the work is risky or reversibility is low
