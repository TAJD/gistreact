# ReactDrop

Host and share React components from GitHub Gists. Drop in a component, see it rendered live in a sandboxed environment.

**Live:** [reactdrop.verdient.co.uk](https://reactdrop.verdient.co.uk)

## Features

- Paste a GitHub Gist URL and get an instant shareable link
- Component validator with 5 automated checks (syntax, imports, exports, size, allowlist)
- Sandpack-based sandbox with Tailwind CSS and 30+ libraries
- GitHub OAuth authentication
- Split view: toggle code alongside preview
- Custom shareable links with collision detection
- Analytics: view counts, popular and recent components
- Report abuse system

## Quick Start

```bash
pnpm install
pnpm dev
```

Requires Node.js 22+ and pnpm 10+.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite at edge)
- **Sandbox:** Sandpack (CodeSandbox)
- **Testing:** Vitest, Playwright, Miniflare

## Testing

```bash
pnpm test:run          # Unit tests
pnpm test:e2e          # E2E tests (Playwright)
pnpm build             # Build verification
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture
- [SECURITY.md](SECURITY.md) - Security policy
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guide
- [CLAUDE.md](CLAUDE.md) - AI assistant context

## License

MIT
