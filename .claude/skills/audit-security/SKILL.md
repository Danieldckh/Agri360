---
name: Security Audit
description: "Use when the user asks to audit security, check for vulnerabilities, find security issues, review auth, check for SQL injection, find hardcoded secrets, or security review. Performs a comprehensive security scan of the ProAgri CRM codebase."
---

# /audit-security — Run Security Scan

Perform a comprehensive security audit of the ProAgri CRM codebase.

## Scan Checklist

Run ALL of these checks and report findings with exact file:line references.

### 1. Credential Scan
- Read `api/config.js` — look for hardcoded passwords, JWT secrets, API keys with fallback values
- Grep for `password`, `secret`, `token`, `api_key`, `apiKey` across all `.js` files
- Check if `.env` is listed in `.gitignore`

### 2. SQL Injection Scan
- Grep all `api/routes/*.js` for string concatenation in SQL queries
- Safe: `pool.query('SELECT * FROM x WHERE id = $1', [id])` — parameterized
- Unsafe: `'SELECT * FROM "' + variable + '"'` — string interpolation
- Check template literals with `${` inside SQL that use request params

### 3. Auth Bypass Scan
- Read each file in `api/routes/` — verify `router.use(requireAuth)` is present
- Check `api/middleware/auth.js` for the AUTH_ENABLED=false bypass behavior
- Ensure all destructive endpoints (POST, PATCH, DELETE) are behind auth

### 4. Input Validation Scan
- Check POST handlers for required field validation (400 responses)
- Check PATCH handlers for empty body validation
- Look for unsanitized user input passed to SQL

### 5. XSS Scan
- Grep frontend JS for `innerHTML` with dynamic data
- Check for `eval()`, `Function()`, `document.write()`
- Safe pattern: `element.textContent = data`

### 6. CORS & Headers
- Check `api/server.js` for CORS configuration (wildcard vs specific origins)
- Check for missing security headers

## Report Format

Use severity levels: CRITICAL, HIGH, MEDIUM, LOW. For each finding:
- **File:line** reference
- **Code snippet** showing the vulnerability
- **Remediation** — specific fix recommendation
