---
name: Add Column
description: "Use when the user asks to add a column, add a field to a table, alter a table to add a column, or needs a quick single-column migration. Simpler than /new-migration for single column additions."
---

# /add-column — Quick Single-Column Migration

Shortcut for adding a single column to an existing table. Faster than /new-migration.

## Step 1: Gather Info

Ask the user for:
- **Table name** (e.g., `deliverables`, `clients`, `booking_forms`)
- **Column name** (snake_case, e.g., `priority_level`)
- **Column type** — one of: `VARCHAR(N)`, `TEXT`, `INT`, `BOOLEAN`, `TIMESTAMPTZ`, `JSONB`, `DECIMAL(12,2)`, `DATE`
- **Default value** (optional, e.g., `'pending'`, `false`, `NOW()`)
- **Foreign key** (optional, e.g., `REFERENCES employees(id)`)

## Step 2: Determine Migration Number

Read `api/migrations/` directory, find highest number, add 1.

## Step 3: Create Migration File

Create `api/migrations/{NNN}_{table}_{column}.js`:

```javascript
const pool = require('../db');

async function up() {
  await pool.query(`
    ALTER TABLE {table}
    ADD COLUMN IF NOT EXISTS {column} {TYPE} {DEFAULT} {FK}
  `);
  console.log('Added {column} to {table}');
}

module.exports = { up };

// Run directly
if (require.main === module) {
  up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
```

## Step 4: Add to db.js Inline Migrations

Read `api/db.js` and append the `ALTER TABLE ADD COLUMN IF NOT EXISTS` statement to the appropriate table's migration block, so fresh databases also get the column.

## Step 5: Report

Tell the user:
- Migration file created at `api/migrations/{NNN}_{name}.js`
- Run with: `node api/migrations/{NNN}_{name}.js`
- Also added to `api/db.js` for fresh bootstrapping
- Reminder: if this column should appear in API responses, check the route file's SELECT queries
