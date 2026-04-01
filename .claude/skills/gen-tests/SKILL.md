---
name: Generate Tests
description: "Use when the user asks to generate tests, write tests for, create test file, add unit tests, test this route, or test this page module. Generates appropriate Jest tests for API routes or frontend modules."
---

# /gen-tests — Generate Tests for a File

Generate Jest tests for a ProAgri CRM API route or frontend module.

## Step 1: Identify Target

Accept a file path as argument, or ask the user which file to test.

Detect the file type:
- **Backend route**: path matches `api/routes/*.js`
- **Frontend module**: path matches `*/js/*.js` (outside api/)
- **Utility**: path matches `api/utils.js` or similar

## Step 2: Ensure Test Infrastructure

Check if Jest is installed in `api/package.json` devDependencies.

If not installed:
1. Run `cd api && npm install --save-dev jest supertest`
2. Add to `api/package.json` scripts: `"test": "jest --verbose"`
3. Create `api/jest.config.js` if missing:
   ```javascript
   module.exports = {
     testEnvironment: 'node',
     testMatch: ['**/__tests__/**/*.test.js'],
     verbose: true
   };
   ```

## Step 3: Read Target File

Read the target file completely. Understand:
- For routes: endpoints, field names, required fields, validation logic, soft/hard delete
- For frontend: render function name, API calls made, DOM structure created
- For utilities: function signatures, input/output types

## Step 4: Generate Tests

### For Backend Routes (`api/routes/*.js`)

Create `api/__tests__/routes/{name}.test.js`:
- Mock `../../db` with `jest.mock` (stub `pool.query`)
- Mock `../../middleware/auth` to bypass auth (inject fake user)
- Use `supertest` to test each HTTP endpoint
- Test cases per endpoint:
  - **GET /**: returns array, handles search param, handles DB error
  - **GET /:id**: returns single record, returns 404 for missing
  - **POST /**: creates record (201), rejects missing required fields (400)
  - **PATCH /:id**: updates record, rejects empty body (400), returns 404
  - **DELETE /:id**: deletes/archives record, returns 404 for missing

### For Frontend Modules (`*/js/*.js`)

Create `{module}/__tests__/{name}.test.js`:
- Use `@jest-environment jsdom` directive
- Mock `window.API_URL`, `window.getAuthHeaders`, `window.getCurrentUser`
- Mock `window.renderSheet` if the page uses ProAgri Sheet
- Mock global `fetch`
- Test: container is cleared, section element created, fetch called with correct URL

## Step 5: Report

Tell the user:
- Test file path created
- Number of test cases
- How to run: `cd api && npx jest __tests__/routes/{name}.test.js --verbose`
- Any setup changes made (jest install, config creation)
