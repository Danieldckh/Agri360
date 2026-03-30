---
name: New Database Migration
description: "Use when the user asks to create a migration, add a column, alter a table, create a new table, add a database field, or generate migration file. Creates a numbered migration file following the ProAgri pattern."
---

# /new-migration — Scaffold a Database Migration

Generate a numbered PostgreSQL migration file for the ProAgri CRM.

## Step 1: Gather Info

Ask the user for:
- **Operation**: add column, create table, add index, add foreign key, or seed data
- **Table name** (existing or new)
- **Column definitions**: name, type, constraints, defaults, foreign key references

## Step 2: Determine Next Number

Read `api/migrations/` directory to find the highest existing number. The next migration is that number + 1, zero-padded to 3 digits.

## Step 3: Generate Migration File

Create `api/migrations/{NNN}_{snake_case_description}.js`:

```javascript
const pool = require('../db');

async function up() {
  // Use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency
}

module.exports = { up };
```

### PostgreSQL Types Available
- `SERIAL PRIMARY KEY`, `VARCHAR(N)`, `TEXT`, `INT`, `DECIMAL(12,2)`
- `BOOLEAN DEFAULT FALSE`, `TIMESTAMPTZ DEFAULT NOW()`, `JSONB`, `DATE`

### Foreign Key Conventions
- `REFERENCES employees(id)` — user assignments
- `REFERENCES clients(id) ON DELETE CASCADE` — client-owned resources
- `REFERENCES departments(id)` — department assignment
- `REFERENCES booking_forms(id) ON DELETE CASCADE` — booking-form resources

## Step 4: Report

Tell the user:
- Migration file path
- What it does
- Run command: `node api/migrations/{NNN}_{description}.js`
- Recommend also adding the ALTER TABLE to `api/db.js` inline migrations for fresh database bootstrapping
