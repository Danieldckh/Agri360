---
name: Inspect Database Schema
description: "Use when the user asks to show schema, inspect database, list tables, show columns, database structure, table relationships, or ER diagram. Reads the database schema from code and produces documentation."
---

# /inspect-schema — Show Database Schema

Read the ProAgri CRM database schema from code and produce documentation.

## Step 1: Read Schema Sources

1. Read `api/db.js` — extract all CREATE TABLE IF NOT EXISTS statements (this is the base schema)
2. Read all files in `api/migrations/*.js` — extract ALTER TABLE / ADD COLUMN statements
3. Merge into complete table map

## Step 2: Parse Schema

For each table, extract:
- Column name
- Column type (SERIAL, VARCHAR, TEXT, INT, DECIMAL, BOOLEAN, TIMESTAMPTZ, JSONB, DATE)
- Constraints (PRIMARY KEY, NOT NULL, DEFAULT, UNIQUE)
- Foreign key references (REFERENCES table(id))

## Step 3: Output

Ask the user what format they want (or provide Quick Summary by default):

### Quick Summary
Table name + column count + key foreign key relationships in a markdown table.

### Full Detail
Every column with complete type information for a specific table or all tables.

### Mermaid ER Diagram
Generate a Mermaid erDiagram showing all tables and their relationships.

### Consistency Check
Compare db.js base schema with migrations. Flag any discrepancies.

## Notes
- This reads CODE, not the live database
- For live data, use the `/api/dev/tables` endpoint
- The dev API at `/api/dev/tables/:name/columns` shows live column info
