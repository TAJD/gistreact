# Component Validator Design

## Overview

A dedicated `/validate` route where users paste React component code to check whether it will deploy successfully on GistReact, before creating a GitHub Gist.

## Architecture

```
/validate route
  ├── Code textarea (monospace, syntax-highlighted via CSS)
  ├── Validation panel (real-time, client-side)
  │   ├── Component detection (AST detector)
  │   ├── Default export check
  │   ├── Import allowlist check
  │   ├── Forbidden import check (fs, path, child_process)
  │   └── Code size check (< 50KB)
  └── Sandpack preview (on-demand, reuses GistRenderer config)
```

## Routing

New `/validate` route handled in `App.tsx` alongside existing `/`, `/{gist-id}`, and `/share/{shareId}` routes.

## Validation Logic

New module `src/utils/componentValidator.ts` that extends `astComponentDetector.ts`:

1. **Component detection** - reuse `detectReactComponents()`
2. **Default export** - check or flag that one can be auto-added
3. **Import allowlist** - parse imports against the Sandpack dependency list
4. **Forbidden imports** - block Node.js builtins (fs, path, child_process, etc.)
5. **Size limit** - reject code > 50KB

All validation runs client-side. No API calls needed.

## Preview

Reuses the exact Sandpack configuration from `GistRenderer.tsx` (same dependencies, template, external resources). Triggered by a "Preview" button that only enables when all validation checks pass.

## Mobile

- Textarea and validation panel stack vertically on small screens
- Sandpack preview goes full-width below
- Touch-friendly button sizing

## Security

- No authentication required for the validator itself (read-only check)
- GitHub OAuth (separate task) will gate future features
- Sandpack iframe isolation provides the same security as existing gist rendering

## Parallel Security Work

- Proxy endpoint hardening: domain allowlist, SSRF prevention, size limits
- CSP headers: add X-Frame-Options, X-Content-Type-Options to worker responses
- Pin Sandpack dependency versions instead of using "latest"
