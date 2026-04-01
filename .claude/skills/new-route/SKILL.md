---
name: New API Route
description: "Use when the user asks to create a new API route, scaffold a route, add a new endpoint, new CRUD API, or generate route file. Produces a complete Express route file matching ProAgri CRM patterns."
---

# /new-route — Scaffold a CRUD API Route

Generate a complete Express CRUD route file following the ProAgri CRM pattern.

## Step 1: Gather Info

Ask the user for (or infer from context):
- **Resource name** (plural, kebab-case, e.g., `tasks`, `invoices`, `time-entries`)
- **Table name** (snake_case, usually same as resource but with underscores)
- **Columns** and their types
- **Required fields** for POST (minimum to create a record)
- **Delete strategy**: soft delete (archive) or hard delete
- **JSONB fields** (if any — objects that need JSON.stringify before insertion)

## Step 2: Read the Template

Read `api/routes/clients.js` — this is the canonical CRUD template. Your generated file must follow this exact pattern.

## Step 3: Generate the Route File

Create `api/routes/{resource-name}.js` with these 5 endpoints:

1. **GET /** — List all with optional `?search=` param, exclude archived, ORDER BY name/created_at
2. **GET /:id** — Single record by ID, 404 if not found
3. **POST /** — Create with `toSnakeBody(req.body)`, validate required fields, dynamic INSERT
4. **PATCH /:id** — Dynamic SET clause from provided fields only
5. **DELETE /:id** — Soft delete (archive) or hard delete per user choice

Always use:
- `const { toCamelCase, toSnakeBody } = require('../utils');`
- `router.use(requireAuth);`
- Parameterized queries (`$1`, `$2`, etc.) — NEVER string concatenation
- `try/catch` with `console.error('{Verb} {resource} error:', err)` + 500 response

## Step 4: Register in server.js

Edit `api/server.js`:
1. Add import after existing route imports (~line 24): `const {camelName}Routes = require('./routes/{resource-name}');`
2. Add mount after existing routes (~line 54): `app.use('/api/{resource-name}', {camelName}Routes);`

## Step 5: Report

Tell the user:
- What was created and where
- The 5 endpoints available
- Remind them to create the database table if it doesn't exist (suggest using `/new-migration`)
