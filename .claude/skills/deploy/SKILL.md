---
name: Deploy
description: "Use when the user asks to deploy, push to production, trigger deployment, or deploy to Coolify. Triggers a deployment via the Coolify API."
---

# /deploy — Trigger Coolify Deployment

Trigger a deployment of the ProAgri CRM via the Coolify API.

## Step 1: Check Prerequisites

1. Verify there are no uncommitted changes: `git status`
2. Verify the current branch matches the deployment branch (`worktree-remove-messaging-folders`)
3. Check that `.env` has `COOLIFY_API_TOKEN` and `COOLIFY_BASE_URL`

If there are uncommitted changes, warn the user and ask if they want to commit first.

## Step 2: Push to Remote

```bash
git push origin HEAD
```

## Step 3: Trigger Deployment

```bash
curl -s -X POST "${COOLIFY_BASE_URL}/api/v1/applications/tows08oogko8k4wk84g40oo4/restart" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -H "Content-Type: application/json"
```

## Step 4: Check Status

```bash
curl -s "${COOLIFY_BASE_URL}/api/v1/applications/tows08oogko8k4wk84g40oo4" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" | jq '.status'
```

## Step 5: Report

Tell the user:
- Deployment triggered successfully (or error details)
- App UUID: `tows08oogko8k4wk84g40oo4`
- Branch deployed
- How to check status manually
