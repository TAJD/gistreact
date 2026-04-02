# Contributing to ReactDrop

## Getting Started

```bash
git clone https://github.com/TAJD/gistreact.git
cd gistreact
pnpm install
pnpm dev
```

Requires Node.js 22+ and pnpm 10+.

## Development

- `pnpm dev` - Start dev server with HMR
- `pnpm build` - Production build
- `pnpm test:run` - Unit tests
- `pnpm vitest run src/test/integration/worker-functions.test.ts --config vitest.integration.config.ts` - Integration tests
- `pnpm test:e2e` - E2E tests (requires Playwright browsers: `pnpm exec playwright install`)
- `pnpm lint` - Lint

## Project Structure

- `src/` - React frontend (Vite + TypeScript)
- `worker/` - Cloudflare Worker backend
- `src/config/` - Shared configuration (Sandpack deps, constants)
- `src/utils/` - Validation and component detection logic
- `tests/e2e/` - Playwright E2E tests

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass
4. Push and open a PR using the template
5. PRs are squash-merged to main

## Deployment

Production deploys happen via `pnpm deploy` (requires Cloudflare auth). The live site is at [reactdrop.verdient.co.uk](https://reactdrop.verdient.co.uk).

## Reporting Issues

Use the GitHub issue templates for bug reports and feature requests. For security vulnerabilities, see [SECURITY.md](SECURITY.md).
