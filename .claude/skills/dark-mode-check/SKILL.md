---
name: Dark Mode Check
description: "Use when the user asks to check dark mode, audit CSS colors, verify theme compatibility, find hardcoded colors, or check dark theme support. Scans CSS for hardcoded colors not using CSS variables."
---

# /dark-mode-check — CSS Dark Theme Audit

Quick scan of CSS files for hardcoded colors that break dark mode.

## Step 1: Determine Scope

If the user specified a file, scan only that file. Otherwise, scan all CSS files:

```
ui/css/styles.css
ui/css/proagri-sheet.css
ui/css/radial-menu.css
pages/*/css/*.css
pages/*/*.css
auth/css/*.css
dev/css/*.css
```

## Step 2: Read Theme Variables

Read `ui/css/styles.css` and extract:
- `:root { ... }` block — all CSS variable definitions with their light theme values
- `[data-theme="dark"] { ... }` block — dark theme overrides

Build a lookup: `#1a1a1a → var(--text-primary)`, etc.

## Step 3: Scan for Hardcoded Colors

Search each CSS file for patterns:
- `#[0-9a-fA-F]{3,8}` (hex colors)
- `rgb\(` and `rgba\(` 
- `hsl\(` and `hsla\(`
- Color keywords as property values: `white`, `black`, `red`, `blue`, etc.

Skip:
- Values inside `var(--...)` — already using variables
- Values inside CSS variable definitions (`:root` and `[data-theme]` blocks)
- Values inside `url(data:image/svg+xml,...)` — SVG data URIs are OK
- CSS comments

## Step 4: Report

```
## Dark Mode Audit: {scope}

### Hardcoded Colors Found: N
| File:Line | Property | Value | Suggestion |
|-----------|----------|-------|------------|
| styles.css:42 | color | #1a1a1a | Use var(--text-primary) |
| page.css:18 | background | white | Use var(--color-secondary) |

### Variables Missing Dark Override: N
| Variable | Light Value |
|----------|-------------|
| --new-color | #f0f0f0 |

### Summary
- N hardcoded colors found
- N have matching CSS variables (easy fix)
- N need new variables or review
```
