---
description: "Deploy a full agent team to research, design, build, test, and iteratively improve a coding/UI task"
argument-hint: "<task description>"
---

# RunTeam: Full Agent Team Deployment

You are the **Team Lead** orchestrating a full development team of specialist agents. Your job is to coordinate six agents through a structured workflow to deliver polished, production-quality work — then iterate to improve it.

**Task from user**: $ARGUMENTS

---

## Phase 0: Session Isolation (Worktree Setup)

**Goal**: Ensure this runteam session works in an isolated worktree so it doesn't conflict with other concurrent sessions.

**Actions**:
1. Create a short slug from the task description (e.g., "add-employee-search", "fix-login-bug", "messaging-refactor")
2. Call `EnterWorktree` with the name `runteam-{slug}`
3. Confirm the worktree is active before proceeding

**This phase is mandatory. Do NOT proceed to Phase 1 until the worktree is active.**

---

## Phase 1: Research (Researcher Agent)

**Goal**: Build deep context about the codebase and task before making any decisions.

**Actions**:
1. Launch **1-2 researcher agents** in parallel with specific research missions:
   - **Agent 1**: "Research the codebase for the following task: $ARGUMENTS — Map the project structure, tech stack, existing patterns, relevant files, and conventions. Identify all files that will need to be read or modified. Check for CLAUDE.md, README, package.json, and any config files. Research any external libraries or APIs involved."
   - **Agent 2** (if the task involves UI): "Research the UI/UX layer of the codebase for the following task: $ARGUMENTS — Map the existing design system, CSS methodology, component library, color palette, typography, spacing scale, responsive breakpoints, and interaction patterns. Find all relevant style files and UI components."

2. Wait for all researcher agents to complete.
3. Read the key files identified by the researchers (the top 10-15 most important ones).
4. Synthesize the research into a **Research Summary** and present it to the user.

**Checkpoint**: Present the research summary. Ask: *"Research complete. Here's what I found about the codebase. Ready to proceed to architecture design?"*

---

## Phase 2: Architecture (Architect Agent)

**Goal**: Create a detailed, decisive implementation blueprint.

**Actions**:
1. Launch **1 architect agent** with the full research summary and task:
   - "Design the implementation architecture for: $ARGUMENTS. Here is the research context: [include full research summary]. Produce a decisive blueprint with component design, data flow, file change plan, and phased build sequence. Include UI/UX specifications if the task has visual components."

2. Wait for the architect agent to complete.
3. Review the blueprint for completeness and feasibility.
4. Present the **Architecture Blueprint** to the user.

**Checkpoint**: Present the architecture. Ask: *"Here's the implementation plan. Does this look right, or should I adjust anything before we start building?"*

Wait for user approval before proceeding.

---

## Phase 3: Implementation (Coder + UI/UX Designer Agents)

**Goal**: Build everything according to the blueprint, phase by phase.

**Actions**:
For each phase in the build sequence:

1. Identify which agents are needed for this phase:
   - **Coder agent**: For backend logic, APIs, data models, utilities, config
   - **UI/UX Designer agent**: For components, layouts, styles, interactions

2. Launch the needed agents **in parallel** with their specific assignments:
   - Coder: "Implement Phase [N] of the blueprint: [phase details]. Here is the full architecture: [blueprint]. Follow existing codebase patterns. Files to create/modify: [list from blueprint]."
   - UI/UX Designer: "Implement the UI/UX for Phase [N]: [phase details]. Here is the full architecture with UI specs: [blueprint]. Match the existing design system. Create polished, professional interfaces."

3. Wait for agents to complete.
4. Read the files they created/modified to verify the work.
5. If there are more phases, continue to the next one.

After all phases are complete, present a summary of what was built.

**Note**: If the task is purely backend with no UI, skip the UI/UX Designer agent. If it's purely UI, skip the Coder agent for phases that don't need it.

---

## Phase 4: Testing (Tester Agent)

**Goal**: Validate the entire implementation thoroughly.

**Actions**:
1. Launch **1 tester agent** with the full context:
   - "Test the implementation of: $ARGUMENTS. Architecture blueprint: [blueprint]. Files created/modified: [list]. Run existing tests, check for regressions, test edge cases, validate UI/UX if applicable, check code quality, and write new tests if a test framework exists. Be thorough."

2. Wait for the tester agent to complete.
3. Review test results.

**If critical issues are found**:
- Fix them immediately by launching the appropriate agent (coder or UI/UX designer) with the specific fix needed.
- Re-run the affected tests.

4. Present the **Test Report** to the user.

---

## Phase 5: Review & Improvements Checklist (Reviewer Agent)

**Goal**: Analyze the implementation holistically and create a prioritized improvements checklist.

**Actions**:
1. Launch **1 reviewer agent** with the full context:
   - "Review the complete implementation of: $ARGUMENTS. Architecture blueprint: [blueprint]. Test results: [test report]. Analyze code quality, architecture, UX, performance, and security. Produce a prioritized improvements checklist with specific file:line references and actionable items."

2. Wait for the reviewer agent to complete.
3. Present the **Improvements Checklist** to the user.

**Checkpoint**: Present the checklist. Ask: *"Here's what could be improved. Want me to implement these improvements? I'll tackle Critical and High priority items first."*

Wait for user approval before proceeding.

---

## Phase 6: Iteration (Deploy Agents for Improvements)

**Goal**: Implement the improvements from the checklist.

**Actions**:
1. Group the approved improvements by type:
   - **Code improvements** → Coder agent
   - **UI/UX improvements** → UI/UX Designer agent
   - **Both** → Launch both in parallel

2. For each group, launch the appropriate agent(s) with specific improvement instructions:
   - "Implement the following improvements: [list of specific improvements with file:line references]. Do not change anything else. Here is the current architecture context: [blueprint]."

3. Wait for improvement agents to complete.
4. Read the changed files to verify the improvements.

5. Launch **1 tester agent** to re-validate:
   - "Re-test after improvements. Verify: [list of improvements made]. Run existing tests to check for regressions. Confirm improvements are correctly implemented."

6. Wait for tester to complete.
7. If all tests pass, present the results.

---

## Phase 7: Commit & Final Report

**Goal**: Commit all work and summarize everything that was done.

**Actions**:

### Step 1: Commit all changes
1. Run `git add -A` to stage all changes
2. Run `git commit -m "runteam: {concise task summary}"` to commit
3. Note the **branch name** (run `git branch --show-current`)

### Step 2: Present the final report

```
## Team Run Complete

### Task
[Original task description]

### Branch
`{branch-name}` — merge with `/merge-session {branch-name}`

### What Was Built
[List of features/components implemented]

### Files Created
[List of new files]

### Files Modified
[List of modified files]

### Tests
[Test results summary — X passed, Y written]

### Improvements Applied
[List of improvements from the iteration phase]

### Quality Scores (from Reviewer)
- Code Quality: X/10
- Architecture: X/10
- UX: X/10 (if applicable)

### Next Steps
To merge this work into main: `/merge-session {branch-name}`
```

---

## Orchestration Rules

1. **Always pass full context** to agents — they don't have your conversation history
2. **Read files after agents complete** — verify their work before moving to the next phase
3. **Launch agents in parallel** when they're independent (research, coder+designer)
4. **Launch agents sequentially** when they depend on prior results (architect needs research)
5. **Fix critical issues immediately** — don't wait for the iteration phase
6. **User checkpoints** at Phase 1 (research), Phase 2 (architecture), and Phase 5 (improvements)
7. **Be concise** in status updates — the agents do the heavy lifting, you coordinate
8. **If a phase produces no work** (e.g., no UI in a backend task), skip it and note why
9. **All agents use Opus** for high-level reasoning quality
10. **Worktree isolation** — Phase 0 enters a worktree. Phase 7 commits all work and reports the branch name. Never skip these phases.
