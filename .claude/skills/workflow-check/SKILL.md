---
name: Workflow Check
description: "Use when the user asks to check workflows, validate status chains, verify deliverable routing, check dept maps, or audit workflow consistency. Read-only diagnostic that compares frontend and backend workflow definitions."
---

# /workflow-check — Validate Deliverable Workflow Consistency

Read-only diagnostic that checks consistency between frontend and backend workflow definitions.

## Step 1: Read Source Files

Read these files (do NOT modify them):
- `ui/js/deliverable-workflows.js` — frontend CHAINS, CHAIN_ALIASES, DEPT_MAPS, BRANCH_STATUSES
- `api/routes/deliverables.js` — backend DEPT_MAPS, DEPT_MAP_ALIASES
- `ui/js/app.js` — `showDeptContent()` routing and `deptMenuItems` config

## Step 2: Extract Data

From each file, extract:
- All deliverable type keys (including aliases)
- For each type: ordered status chain
- For each type: status → department mapping
- For each type: branch statuses and their targets
- From app.js: which department tabs exist and what they filter for

## Step 3: Run Checks

### A. Chain Completeness
For each type, verify every status in the chain has a DEPT_MAP entry.
Report: "Type 'magazine', status 'editing' — missing from DEPT_MAP"

### B. Frontend ↔ Backend Match
Compare frontend DEPT_MAPS with backend DEPT_MAPS entry by entry.
Report: "Type 'sm-posts', status 'artwork_design' — frontend maps to 'design', backend maps to 'production'"

### C. Branch Status Validity
For each branch status, verify the target status exists in the chain.
Report: "Type 'video', branch 'changes_requested' targets 'editing' — OK / NOT FOUND"

### D. Alias Consistency
Verify CHAIN_ALIASES and DEPT_MAP_ALIASES point to valid base types.

### E. Department Tab Coverage
For each department, list all statuses that route to it. Then check if `showDeptContent()` has a dedicated route or if the tab falls through to generic view.

## Step 4: Output Report

Format as a clear table:

```
## Workflow Validation Report

### Chain Completeness: ✓ PASS / ✗ N issues
### Frontend ↔ Backend: ✓ PASS / ✗ N mismatches  
### Branch Statuses: ✓ PASS / ✗ N issues
### Alias Consistency: ✓ PASS / ✗ N issues

### Department Coverage
| Department | Statuses Routed | Tabs with Dedicated Views | Generic Fallback |
|------------|----------------|--------------------------|------------------|
| admin      | 5              | 4 tabs                   | 0 statuses       |
| design     | 12             | 2 tabs                   | 10 statuses      |
| ...

### Issues Found
1. [description with file:line reference]
2. ...
```
