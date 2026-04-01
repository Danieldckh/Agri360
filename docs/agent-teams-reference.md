# Agent Teams — Master Reference Guide

> **Version**: Claude Code v2.1.32+
> **Status**: Experimental (disabled by default)
> **Last Updated**: 2026-03-30
> **Source**: [Official Docs](https://code.claude.com/docs/en/agent-teams)

---

## Table of Contents

1. [What Are Agent Teams?](#1-what-are-agent-teams)
2. [Agent Teams vs Subagents](#2-agent-teams-vs-subagents)
3. [Enabling Agent Teams](#3-enabling-agent-teams)
4. [Architecture](#4-architecture)
5. [Starting a Team](#5-starting-a-team)
6. [Display Modes](#6-display-modes)
7. [Controlling Your Team](#7-controlling-your-team)
8. [Task System](#8-task-system)
9. [Communication & Messaging](#9-communication--messaging)
10. [Permissions](#10-permissions)
11. [Hooks & Quality Gates](#11-hooks--quality-gates)
12. [Best Practices](#12-best-practices)
13. [Use Case Examples](#13-use-case-examples)
14. [Troubleshooting](#14-troubleshooting)
15. [Known Limitations](#15-known-limitations)
16. [Quick Reference Cheat Sheet](#16-quick-reference-cheat-sheet)

---

## 1. What Are Agent Teams?

Agent teams let you coordinate **multiple Claude Code instances** working together on a shared task. One session acts as the **team lead**, coordinating work, assigning tasks, and synthesizing results. **Teammates** work independently, each in its own context window, and can communicate directly with each other.

### Key Properties

- Each teammate is a **full, independent Claude Code session**
- Teammates share a **task list** but have **separate context windows**
- The lead's conversation history does **not** carry over to teammates
- Teammates load project context automatically (CLAUDE.md, MCP servers, skills)
- You can interact with individual teammates directly (not just through the lead)

### When to Use Agent Teams

| Good For | Not Good For |
|----------|-------------|
| Research & review (parallel investigation) | Sequential tasks with many dependencies |
| New modules/features (separate file ownership) | Same-file edits |
| Debugging with competing hypotheses | Routine/simple tasks |
| Cross-layer coordination (frontend + backend + tests) | Tasks where coordination overhead > benefit |

---

## 2. Agent Teams vs Subagents

Both parallelize work, but they operate differently. **Choose based on whether workers need to communicate with each other.**

| | Subagents | Agent Teams |
|:--|:--|:--|
| **Context** | Own context window; results return to caller | Own context window; fully independent |
| **Communication** | Report results back to main agent only | Teammates message each other directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **Best for** | Focused tasks where only the result matters | Complex work requiring discussion & collaboration |
| **Token cost** | Lower: results summarized back to main context | Higher: each teammate is a separate Claude instance |

**Rule of thumb:**
- Use **subagents** for quick, focused workers that report back
- Use **agent teams** when teammates need to share findings, challenge each other, and coordinate independently

---

## 3. Enabling Agent Teams

Agent teams are disabled by default. Enable via environment variable:

### Option A: Project Settings (recommended for this project)

File: `.claude/settings.local.json`

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Option B: User-Level Settings

File: `~/.claude/settings.json`

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Option C: Shell Environment

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

> **Note**: Restart Claude Code after changing settings for the variable to take effect.

---

## 4. Architecture

An agent team consists of four components:

| Component | Role |
|:--|:--|
| **Team Lead** | The main Claude Code session that creates the team, spawns teammates, and coordinates work |
| **Teammates** | Separate Claude Code instances that each work on assigned tasks |
| **Task List** | Shared list of work items that teammates claim and complete |
| **Mailbox** | Messaging system for communication between agents |

### Storage Locations

| Data | Path |
|:--|:--|
| Team config | `~/.claude/teams/{team-name}/config.json` |
| Task list | `~/.claude/tasks/{team-name}/` |

The team config contains a `members` array with each teammate's **name**, **agent ID**, and **agent type**. Teammates can read this file to discover other team members.

### How Teams Get Started

Two ways:

1. **You request a team**: Describe the task and explicitly ask for an agent team
2. **Claude proposes a team**: Claude determines your task would benefit from parallel work and suggests creating one — you confirm before it proceeds

Claude **never** creates a team without your approval.

---

## 5. Starting a Team

Tell Claude to create an agent team in natural language. Describe the task and team structure you want.

### Basic Example

```
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Create an agent team to explore this from different angles:
one teammate on UX, one on technical architecture, one playing devil's advocate.
```

### What Happens

1. Claude creates a team with a shared task list
2. Spawns teammates for each role
3. Teammates explore the problem independently
4. Lead synthesizes findings
5. Team cleans up when finished

### Specifying Team Size and Models

```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

---

## 6. Display Modes

### In-Process Mode (Default)

All teammates run inside your main terminal.

| Action | Shortcut |
|:--|:--|
| Cycle through teammates | `Shift+Down` |
| View teammate session | `Enter` |
| Interrupt teammate's turn | `Escape` |
| Toggle task list | `Ctrl+T` |
| Wrap to lead | `Shift+Down` (after last teammate) |

Works in **any terminal**, no extra setup required.

### Split-Pane Mode

Each teammate gets its own pane. You see everyone's output at once.

**Requirements**: `tmux` or iTerm2 with [`it2` CLI](https://github.com/mkusaka/it2)

> **Note**: `tmux` works best on macOS. Using `tmux -CC` in iTerm2 is the suggested entry point.
> Split-pane mode is **not supported** in VS Code terminal, Windows Terminal, or Ghostty.

### Configuration

**Global config** (`~/.claude.json`):

```json
{
  "teammateMode": "in-process"
}
```

Options: `"auto"` (default), `"in-process"`, `"tmux"`

- `"auto"`: Uses split panes if already in a tmux session, otherwise in-process
- `"tmux"`: Auto-detects whether to use tmux or iTerm2

**Per-session override**:

```bash
claude --teammate-mode in-process
```

### Installing tmux / iTerm2

- **tmux**: Install through your system's package manager ([tmux wiki](https://github.com/tmux/tmux/wiki/Installing))
- **iTerm2**: Install [`it2` CLI](https://github.com/mkusaka/it2), then enable Python API in **iTerm2 → Settings → General → Magic → Enable Python API**

---

## 7. Controlling Your Team

All control happens through **natural language** to the lead.

### Require Plan Approval

For complex/risky tasks, require teammates to plan before implementing:

```
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

**Flow**:
1. Teammate works in **read-only plan mode**
2. Finishes planning → sends plan approval request to lead
3. Lead reviews and **approves** or **rejects with feedback**
4. If rejected → teammate revises and resubmits
5. If approved → teammate exits plan mode, begins implementation

**Influence approval criteria**:
```
Only approve plans that include test coverage
Reject plans that modify the database schema
```

### Talk to Teammates Directly

Each teammate is a full, independent session. You can:
- Give additional instructions
- Ask follow-up questions
- Redirect their approach

**In-process**: `Shift+Down` to cycle, then type
**Split-pane**: Click into the pane

### Shut Down a Teammate

```
Ask the researcher teammate to shut down
```

The teammate can approve (exits gracefully) or reject with an explanation.

### Clean Up the Team

```
Clean up the team
```

> **Important**: Always use the **lead** to clean up. Teammates should NOT run cleanup — their team context may not resolve correctly. Shut down all teammates before cleaning up.

---

## 8. Task System

The shared task list coordinates work across the team.

### Task States

| State | Description |
|:--|:--|
| **Pending** | Not yet started |
| **In Progress** | Claimed by a teammate |
| **Completed** | Work finished |

### Task Dependencies

- Tasks can depend on other tasks
- A pending task with unresolved dependencies **cannot be claimed** until those dependencies are completed
- When a teammate completes a task, blocked tasks unblock **automatically**

### Task Assignment

Two modes:
1. **Lead assigns**: Tell the lead which task to give to which teammate
2. **Self-claim**: After finishing a task, a teammate picks up the next unassigned, unblocked task

> Task claiming uses **file locking** to prevent race conditions when multiple teammates try to claim the same task simultaneously.

### Sizing Tasks

| Size | Problem |
|:--|:--|
| Too small | Coordination overhead exceeds the benefit |
| Too large | Teammates work too long without check-ins, increasing wasted effort risk |
| Just right | Self-contained units with a clear deliverable (a function, a test file, a review) |

**Guideline**: Aim for **5-6 tasks per teammate** to keep everyone productive without excessive context switching.

---

## 9. Communication & Messaging

### How Teammates Share Information

| Mechanism | Description |
|:--|:--|
| **Automatic message delivery** | Messages are delivered automatically to recipients — lead doesn't need to poll |
| **Idle notifications** | When a teammate finishes and stops, they automatically notify the lead |
| **Shared task list** | All agents can see task status and claim available work |

### Messaging Types

| Type | Description | Usage Note |
|:--|:--|:--|
| **message** | Send to one specific teammate | Standard communication |
| **broadcast** | Send to all teammates simultaneously | Use sparingly — costs scale with team size |

### Context at Spawn

Teammates automatically receive:
- ✅ CLAUDE.md project context
- ✅ MCP servers
- ✅ Skills
- ✅ Spawn prompt from lead
- ❌ Lead's conversation history (does NOT carry over)

---

## 10. Permissions

- Teammates start with the **lead's permission settings**
- If the lead runs with `--dangerously-skip-permissions`, all teammates do too
- After spawning, you **can** change individual teammate modes
- You **cannot** set per-teammate modes at spawn time

**Tip**: Pre-approve common operations in your permission settings before spawning teammates to reduce interruptions.

---

## 11. Hooks & Quality Gates

Use [hooks](https://code.claude.com/docs/en/hooks) to enforce rules when teammates finish work or tasks change:

| Hook | When It Fires | Exit Code 2 Effect |
|:--|:--|:--|
| `TeammateIdle` | When a teammate is about to go idle | Sends feedback, keeps teammate working |
| `TaskCreated` | When a task is being created | Prevents creation, sends feedback |
| `TaskCompleted` | When a task is being marked complete | Prevents completion, sends feedback |

---

## 12. Best Practices

### 1. Give Teammates Enough Context

Teammates don't inherit the lead's conversation history. Include task-specific details in the spawn prompt:

```
Spawn a security reviewer teammate with the prompt: "Review the authentication
module at src/auth/ for security vulnerabilities. Focus on token handling,
session management, and input validation. The app uses JWT tokens stored in
httpOnly cookies. Report any issues with severity ratings."
```

### 2. Choose an Appropriate Team Size

- Start with **3-5 teammates** for most workflows
- 5-6 tasks per teammate keeps everyone productive
- Scale up only when work genuinely benefits from parallel execution
- Three focused teammates often **outperform** five scattered ones

### 3. Avoid File Conflicts

Two teammates editing the same file leads to overwrites. **Break work so each teammate owns different files.**

### 4. Wait for Teammates to Finish

If the lead starts implementing instead of delegating:

```
Wait for your teammates to complete their tasks before proceeding
```

### 5. Start with Research and Review

If new to agent teams, start with non-coding tasks:
- Reviewing a PR
- Researching a library
- Investigating a bug

### 6. Monitor and Steer

Check in on progress, redirect approaches that aren't working, and synthesize findings as they come in. Don't let a team run unattended too long.

---

## 13. Use Case Examples

### Parallel Code Review

```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

**Why it works**: Each reviewer applies a different filter to the same PR. The lead synthesizes findings across all three.

### Competing Hypothesis Debugging

```
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses. Have them talk to
each other to try to disprove each other's theories, like a scientific debate.
Update the findings doc with whatever consensus emerges.
```

**Why it works**: Multiple investigators actively trying to disprove each other avoids the anchoring bias of sequential investigation. The theory that survives is more likely to be the actual root cause.

### Cross-Layer Feature Build

```
Create an agent team to build the new notifications feature:
- Backend teammate: owns api/routes/notifications.js and migrations
- Frontend teammate: owns notifications/js/ and notifications/css/
- Test teammate: owns all test files
Have them coordinate on the API contract first, then build in parallel.
```

### Research from Multiple Angles

```
Create an agent team to explore this from different angles:
- One teammate on UX
- One on technical architecture
- One playing devil's advocate
```

---

## 14. Troubleshooting

### Teammates Not Appearing

| Check | Solution |
|:--|:--|
| In-process mode | Press `Shift+Down` — teammates may be running but not visible |
| Task complexity | Claude only spawns teams for complex tasks. Ask explicitly if needed |
| Split pane setup | Verify tmux is installed: `which tmux` |
| iTerm2 | Verify `it2` CLI is installed and Python API is enabled |

### Too Many Permission Prompts

Pre-approve common operations in your permission settings before spawning teammates.

### Teammates Stopping on Errors

1. Check their output (`Shift+Down` or click pane)
2. Give additional instructions directly, OR
3. Spawn a replacement teammate

### Lead Shuts Down Too Early

Tell the lead:
```
Keep going — wait for all teammates to finish before wrapping up.
```

### Orphaned tmux Sessions

```bash
tmux ls
tmux kill-session -t <session-name>
```

---

## 15. Known Limitations

| Limitation | Details |
|:--|:--|
| **No session resumption** | `/resume` and `/rewind` do not restore in-process teammates. Tell the lead to spawn new ones. |
| **Task status can lag** | Teammates sometimes fail to mark tasks completed, blocking dependents. Manually update or nudge. |
| **Slow shutdown** | Teammates finish current request/tool call before shutting down. |
| **One team per session** | Clean up the current team before starting a new one. |
| **No nested teams** | Teammates cannot spawn their own teams. Only the lead manages the team. |
| **Fixed lead** | The session that creates the team is the lead for its lifetime. No promotion/transfer. |
| **Permissions at spawn** | All teammates start with lead's permission mode. Change individually after spawning. |
| **Split panes limited** | Not supported in VS Code terminal, Windows Terminal, or Ghostty. |

---

## 16. Quick Reference Cheat Sheet

### Keyboard Shortcuts (In-Process Mode)

| Shortcut | Action |
|:--|:--|
| `Shift+Down` | Cycle through teammates |
| `Enter` | View teammate session |
| `Escape` | Interrupt teammate's turn |
| `Ctrl+T` | Toggle task list |

### Common Commands (Natural Language to Lead)

```
Create a team with 3 teammates to [task description]
Use Sonnet for each teammate
Require plan approval before they make changes
Wait for your teammates to complete their tasks
Ask the [name] teammate to shut down
Clean up the team
```

### Settings Quick Reference

| Setting | File | Value |
|:--|:--|:--|
| Enable agent teams | `.claude/settings.local.json` | `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` |
| Display mode | `~/.claude.json` | `"teammateMode": "in-process" \| "tmux" \| "auto"` |
| CLI override | — | `claude --teammate-mode in-process` |

### Token Cost Awareness

| Team Size | Cost Multiplier | Notes |
|:--|:--|:--|
| 1 (no team) | 1× | Baseline |
| 3 teammates | ~4× | Lead + 3 teammates, each with own context |
| 5 teammates | ~6× | Diminishing returns beyond this |

### File Locations

| Data | Path |
|:--|:--|
| Team config | `~/.claude/teams/{team-name}/config.json` |
| Task list | `~/.claude/tasks/{team-name}/` |
| Project settings | `.claude/settings.local.json` |
| Global config | `~/.claude.json` |

---

## ProAgri CRM — Project-Specific Notes

This project already has agent teams enabled in `.claude/settings.local.json`.

When using agent teams for ProAgri CRM development, consider these team structures:

### Feature Development Team
```
Create an agent team to build [feature]:
- Backend teammate: owns api/routes/ files and migrations
- Frontend teammate: owns [module]/js/ and [module]/css/ files
- Integration teammate: owns index.html script tags and app.js routing
```

### Bug Investigation Team
```
Create an agent team to investigate [bug]:
- Database teammate: checks migrations, queries, and db.js
- API teammate: checks route handlers and middleware
- Frontend teammate: checks DOM manipulation and API calls
```

### Code Review Team
```
Create an agent team to review recent changes:
- Security reviewer: auth middleware, JWT handling, input validation
- Performance reviewer: database queries, N+1 problems, caching
- UX reviewer: frontend responsiveness, accessibility, error states
```
