---
name: Department Status Map
description: "Use when the user asks to see which statuses belong to which department, show department routing, list dept statuses, or wants a reference map for department tab planning."
---

# /dept-status-map — Show Department → Status Routing Map

Quick reference that reads `ui/js/deliverable-workflows.js` and outputs a formatted table showing which statuses route to each department for each deliverable type.

## Step 1: Read Workflow File

Read `ui/js/deliverable-workflows.js` and extract:
- CHAINS (all status chains per type)
- CHAIN_ALIASES (types that share chains)
- DEPT_MAPS (status → department mapping per type)
- BRANCH_STATUSES (branch statuses per type)

## Step 2: Build Department Map

For each department (admin, production, design, editorial, video, agri4all, social-media):
- Collect all (type, status) pairs where DEPT_MAP maps status to this department
- Include branch statuses that route to this department
- Group by deliverable type

## Step 3: Output Table

Format as:

```
## Department Status Routing Map

### Admin
| Type | Statuses |
|------|----------|
| (booking forms) | outline_proposal, design_proposal, sent_to_client, ... |

### Production  
| Type | Statuses |
|------|----------|
| sm-content-calendar | request_focus_points, focus_points_requested, focus_points_received |
| sm-posts | request_client_materials, upload_materials |
| ...

### Design
| Type | Statuses |
|------|----------|
| sm-content-calendar | design, design_review, design_changes |
| magazine | design, design_review, design_changes |
| ...

### Editorial
...

### Video
...

### Agri4All
...

### Social Media
...
```

This is a READ-ONLY skill — do not modify any files.
