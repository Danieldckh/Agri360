# Agri360 v3 — Sheet Registry

Canonical list of every sheet used in Agri360 v3. **Globally unique IDs.** No two sheets may share an ID. If the "same" sheet appears in two places, both reference the same ID — that's how we track reuse.

This file is the contract for sheet identity across the whole app. Every sheet must be entered here **before** it appears in a mock page. See `PROJECT_SPEC.md` → Build Approach §4 for the rules.

## ID format

```
sh.<owner>.<context>.<purpose>
```

- `<owner>` — the part of the system the sheet belongs to: `admin`, `client`, `lead`, `production`, `design`, `editorial`, `video`, `agri4all`, `social`, `portal`, `deliverable`, `shoot`, `freelancer`, `magazine`, `messaging`, `notification`, `system`, etc.
- `<context>` — the page or tab the sheet lives in. Optional if the owner is unambiguous.
- `<purpose>` — what the sheet shows.

Examples:
- `sh.admin.proposals.outline_queue`
- `sh.client.booking_forms`
- `sh.production.client_communications`
- `sh.deliverable.row` (the universal deliverable sheet, instantiated everywhere)

## Schema for each entry

| Field | Description |
|---|---|
| `id` | The globally unique sheet ID. |
| `display_name` | What the user sees as the sheet title. |
| `purpose` | One sentence — what this sheet shows and why it exists. |
| `data_source` | The underlying entity/table this sheet reads from. |
| `filter` | The default filter applied to the data source (if any). |
| `default_sort` | The default ordering. |
| `columns` | Ordered list of columns shown by default. |
| `row_actions` | Which radial-menu actions are valid on a row in this sheet. |
| `used_in` | Every page or tab that mounts this sheet. |
| `notes` | Empty state, edge cases, anything unusual. |
| `status` | `proposed` (in walkthrough) → `mocked` (in HTML mock) → `wired` (Pass 2 behavior). |

---

## Registered sheets

> Empty. Sheets get added here as the chapter walkthrough introduces them. Each entry will follow the schema above.

<!--
Example entry — DO NOT remove this comment block; it's the template.

### `sh.example.context.purpose`

- **Display name:** Example Sheet
- **Purpose:** One sentence describing what this sheet shows and why.
- **Data source:** `example_table`
- **Filter:** `WHERE is_active = true`
- **Default sort:** `created_at DESC`
- **Columns:** Title · Status · Owner · Last activity
- **Row actions:** Open · Edit · Decline · Archive
- **Used in:** `/admin/example` (tab "Examples"), `/client/:id` (nested under "Examples")
- **Notes:** Empty state shows "No examples yet" with a Create button.
- **Status:** proposed
-->
