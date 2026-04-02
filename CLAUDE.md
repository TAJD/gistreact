# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the ReactDrop codebase.

## Branding

The project was renamed from GistReact to **ReactDrop**. The worker name in wrangler.jsonc is `reactdrop`.
The custom domain is `reactdrop.verdient.co.uk`. Do not use "GistReact" in any new code or content.

## OAuth

GitHub OAuth credentials are stored as Cloudflare Worker secrets (not in code):
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` set via `npx wrangler secret put`
- Local dev uses `.dev.vars` (gitignored) - Wrangler reads this automatically
- OAuth cookies are HMAC-signed using `crypto.subtle` with the client secret

## Deployment

```bash
# Deploy to Cloudflare Workers (builds first, cleans .dev.vars from output)
pnpm deploy

# Store a secret on the deployed worker
echo "value" | npx wrangler secret put SECRET_NAME
```

**Windows Git Bash gotcha:** Prefix wrangler/gh API commands with `MSYS_NO_PATHCONV=1` to prevent path mangling (e.g., `/user` becoming `C:/Program Files/Git/user`).

## Validator Feature

- Route: `/validate` - code-split with lazy import
- Validation logic: `src/utils/componentValidator.ts` (5 client-side checks)
- Sandpack preview reuses the same dependency config as GistRenderer
- Auth state shown in validator nav (GitHub avatar + username)

## Code Splitting

GistRenderer and ValidatorPage use `React.lazy()` + `Suspense` in App.tsx.
The landing page loads eagerly since it's the most common entry point.

## CI Pipeline

CI runs 5 jobs: lint-and-typecheck, unit-tests, integration-tests, build, e2e.
- Unit tests: `src/utils/` + `src/components/LandingPage.test.tsx` (GistRenderer tests excluded - broken mocks)
- Integration: `src/test/integration/worker-functions.test.ts` only (d1/real-d1 tests have Node.js compat issues)
- E2E: Playwright Chromium only, `continue-on-error: true` (selectors need tightening)

## R2 Backup

- Bucket: `reactdrop-backups`, binding: `BACKUPS`
- Cron: `0 3 * * *` (daily at 3am UTC)
- Exports gist_analytics, stored_gists, abuse_reports as JSON
- Retains last 30 backups, auto-prunes older ones

## Search and Direct Upload

- `/api/search?q=query` - FTS5 full-text search with LIKE fallback
- `/api/upload` - Direct component deploy (requires OAuth, stores with `source='upload'`)
- `component_search` FTS5 virtual table with sync triggers on stored_gists

## D1 Migrations

Schema changes must be applied to remote D1 manually:
```bash
MSYS_NO_PATHCONV=1 npx wrangler d1 execute gist-analytics --remote --command "SQL HERE"
```

## Gotchas

- Cloudflare Workers: no `crypto.randomUUID()` or async I/O at module scope
- Sandpack CDN: pinned versions don't work, must use `latest`
- `@cloudflare/vite-plugin` version must match wrangler major version
- Playwright strict mode: avoid loose selectors like `locator('h3')` - use `getByRole` or `data-testid`

## GitHub Security

Enabled via API: vulnerability alerts, Dependabot security updates, secret scanning, push protection.
Check alerts: `gh api /repos/TAJD/gistreact/dependabot/alerts`

## Development Commands

**Note: This project uses pnpm as the package manager. Always use pnpm instead of npm.**

```bash
# Start development server with HMR
pnpm dev

# Build for production
pnpm build

# Lint code
pnpm lint

# Preview production build locally
pnpm preview

# Deploy to Cloudflare Workers
pnpm deploy

# Generate Cloudflare Workers TypeScript types
pnpm cf-typegen

# Install dependencies
pnpm install

# Add new dependencies
pnpm add <package-name>

# Run unit tests
pnpm test:run

# Run integration tests
pnpm test:integration

# Run integration tests with UI
pnpm test:integration:ui

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Run all test suites
pnpm test:all
```

## Architecture Overview

This is a React + TypeScript + Vite application configured to deploy as a Cloudflare Worker with static assets.

### Key Components:
- **Frontend**: React 19 with TypeScript, built using Vite and SWC for fast refresh
- **Backend**: Cloudflare Worker (`worker/index.ts`) handles API routes under `/api/`
- **Deployment**: Uses Wrangler for deploying to Cloudflare Workers platform

### Project Structure:
- `src/App.tsx` - Main React component with example API integration
- `worker/index.ts` - Cloudflare Worker entry point handling API requests
- `vite.config.ts` - Vite configuration with Cloudflare plugin
- `wrangler.jsonc` - Cloudflare Workers deployment configuration

### API Integration:
The frontend makes requests to `/api/` routes which are handled by the Cloudflare Worker. The worker exports a default handler that processes requests based on pathname.

### Development Workflow:
1. Use `pnpm dev` for local development with hot reload
2. API routes are proxied to the worker during development
3. Build and deploy using `pnpm deploy` which builds the frontend and deploys to Cloudflare Workers
4. Static assets are served with SPA routing configured

### TypeScript Configuration:
Multiple tsconfig files for different contexts:
- `tsconfig.app.json` - Main application
- `tsconfig.node.json` - Node/build tools
- `tsconfig.worker.json` - Cloudflare Worker

## GistReact System

GistReact hosts React components from GitHub Gists with the following features:

### Setup Requirements:
1. Create D1 database: `wrangler d1 create gist-analytics`
2. Update `database_id` in `wrangler.jsonc` with the returned ID
3. Initialize database: `wrangler d1 execute gist-analytics --file=./schema.sql`

### URL Structure:
- `/` - Landing page with recent and popular components
- `/{gist-id}` - Renders the React component from the specified gist
- `/share/{shareId}` - Renders component from custom shareable link
- `/api/recent` - Returns recent gists
- `/api/popular` - Returns popular gists by view count
- `/api/update-share-id` - Updates custom shareable link name (with collision detection)
- `/proxy?url=...` - Proxy endpoint to avoid CORS issues

### Component Requirements:
- Must be a `.tsx` file in the gist
- Must export a default React component
- Can only import from allow-listed libraries (React, lodash, date-fns, etc.)
- External API calls are automatically proxied to avoid CORS
- Full Tailwind CSS support with all utility classes available

### Technical Implementation:
- **Sandpack Integration**: Uses CodeSandbox Sandpack for isolated component rendering in an iframe sandbox
- **AST-Based Detection**: TypeScript AST parsing (`astComponentDetector.ts`) automatically detects and extracts React components from gist code
- **Component Execution**: Detected components are wrapped and executed in Sandpack's secure environment
- **Shareable Links**: Auto-generated 8-character IDs with collision detection; users can customize to readable names (min 3 chars, alphanumeric + hyphens/underscores)

### Security Features:
- Sandboxed component execution in isolated iframe
- Fetch/XMLHttpRequest override to use proxy
- External library allowlist enforcement
- Error boundaries for component failures

### Analytics:
- D1 database tracks view counts, errors, and timestamps
- No caching - always fetches fresh content from GitHub

## 🚨 CRITICAL TESTING REQUIREMENTS

**NEVER CONSIDER WORK COMPLETE UNTIL ALL TESTS PASS**

### Test Environments:
- **Unit Tests** (`vitest.config.ts`): React components and utilities using jsdom environment
- **Integration Tests** (`vitest.integration.config.ts`): Worker functions and D1 database operations using Miniflare for D1 emulation in node environment
- **E2E Tests** (`playwright.config.ts`): Full user flows across multiple browsers (Chromium, Firefox, WebKit, Mobile Chrome)

### Integration Testing with Miniflare:

**What is Miniflare?** A local simulator for Cloudflare Workers that runs in Node.js, emulating the Workers runtime including D1 databases (SQLite-based), KV storage, R2, and service bindings.

**Two Testing Strategies:**

1. **Mock Approach** (`worker-functions.test.ts`):
   - Custom JavaScript object mimicking D1's API (`.prepare()`, `.bind()`, `.first()`, `.all()`, `.run()`)
   - In-memory JavaScript arrays for data storage
   - ✅ Ultra-fast, no dependencies, great for unit testing logic
   - ⚠️ Doesn't test actual SQL syntax or D1 quirks

2. **Miniflare Approach** (`worker-integration.test.ts`):
   - Real SQLite database created in-memory via Miniflare
   - Tests actual worker code with real D1 queries
   - Ephemeral databases (`d1Persist: false`) destroyed after tests
   - ✅ High fidelity to production, tests SQL syntax, finds edge cases
   - ✅ No network calls, no cost, no cleanup needed
   - ⚠️ Slightly slower (still fast at ~600ms for full suite)

**How Miniflare Works:**
- Creates **real SQLite database in memory** (not a mock)
- Real SQL execution with proper ACID transactions
- Schema management with DDL statements
- Indexes and performance characteristics match production
- `mf.dispatchFetch()` sends requests directly to worker without HTTP overhead
- Each test initializes schema via `/api/init-schema` endpoint and cleans data via `/api/cleanup`

For detailed architecture diagrams and explanation, see `ARCHITECTURE.md`.

### Mandatory Test Execution Before Completion:

1. **Always run the full test suite before finishing any task:**
   ```bash
   # Run unit tests
   pnpm test:run
   
   # Run integration tests (working subset)
   pnpm vitest run src/test/integration/worker-functions.test.ts --config vitest.integration.config.ts
   
   # Run E2E tests
   pnpm test:e2e
   
   # Run build to ensure no compilation errors
   pnpm build
   
   # Run linting (can have warnings but should not fail)
   pnpm lint
   ```

2. **Integration Test Requirements:**
   - The ephemeral D1 database integration tests MUST pass
   - `worker-functions.test.ts` should show 11/11 tests passing
   - These tests verify D1 database operations, analytics, and shareable links

3. **Test Failure Response Protocol:**
   - If ANY test fails, investigate and fix the root cause
   - Do not implement workarounds that bypass failing tests
   - Do not mark tasks as complete with failing tests
   - If tests were passing before changes, ensure they still pass after

4. **CI/CD Compatibility:**
   - Tests must pass in both local environment and GitHub Actions CI
   - Ensure Node.js v22.16.0 and pnpm v10.12.1 compatibility
   - Integration tests use ephemeral databases (no external dependencies)

5. **Test Coverage Requirements:**
   - Unit tests for React components and utility functions
   - Integration tests for D1 database operations and API endpoints
   - E2E tests for user interface interactions
   - Build verification to ensure production deployment works

### Quality Gates:
- ✅ All unit tests pass
- ✅ Integration tests with ephemeral D1 databases pass  
- ✅ E2E tests pass
- ✅ TypeScript compilation succeeds
- ✅ Build completes successfully
- ✅ No critical linting errors

**Remember: Passing tests are the ultimate measure of code quality and functionality. Never compromise on test quality to rush completion.**