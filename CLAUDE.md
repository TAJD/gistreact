# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
1. Use `npm run dev` for local development with hot reload
2. API routes are proxied to the worker during development
3. Build and deploy using `npm run deploy` which builds the frontend and deploys to Cloudflare Workers
4. Static assets are served with SPA routing configured

### TypeScript Configuration:
Multiple tsconfig files for different contexts:
- `tsconfig.app.json` - Main application
- `tsconfig.node.json` - Node/build tools
- `tsconfig.worker.json` - Cloudflare Worker

## Gist Hoster System

This application hosts React components from GitHub Gists with the following features:

### Setup Requirements:
1. Create D1 database: `wrangler d1 create gist-analytics`
2. Update `database_id` in `wrangler.jsonc` with the returned ID
3. Initialize database: `wrangler d1 execute gist-analytics --file=./schema.sql`

### URL Structure:
- `/` - Landing page with recent and popular components
- `/{gist-id}` - Renders the React component from the specified gist
- `/api/recent` - Returns recent gists
- `/api/popular` - Returns popular gists by view count
- `/proxy?url=...` - Proxy endpoint to avoid CORS issues

### Component Requirements:
- Must be a `.tsx` file in the gist
- Must export a default React component
- Can only import from allow-listed libraries (React, lodash, date-fns, etc.)
- External API calls are automatically proxied to avoid CORS

### Security Features:
- Sandboxed component execution
- Fetch/XMLHttpRequest override to use proxy
- External library allowlist enforcement
- Error boundaries for component failures

### Analytics:
- D1 database tracks view counts, errors, and timestamps
- Cache API caches gist content for 1 hour
- 404 responses cached for 5 minutes