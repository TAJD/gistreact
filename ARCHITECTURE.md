# ReactDrop Architecture

This document describes the technical architecture of ReactDrop, a platform for hosting React components from GitHub Gists.

## Table of Contents

- [System Overview](#system-overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Database Schema](#database-schema)
- [Component Rendering Pipeline](#component-rendering-pipeline)
- [Shareable Links System](#shareable-links-system)
- [Testing Architecture](#testing-architecture)

---

## System Overview

ReactDrop is a full-stack application deployed on Cloudflare's edge network, combining:
- **Frontend**: React 19 + TypeScript + Vite (SPA)
- **Backend**: Cloudflare Worker (edge compute)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **CDN**: Cloudflare static assets

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│                                                                 │
│  ┌──────────────┐         ┌──────────────────────────────────┐ │
│  │ React App    │────────▶│  Sandpack (CodeSandbox)          │ │
│  │ (SPA)        │         │  Isolated iframe for components  │ │
│  └──────┬───────┘         └──────────────────────────────────┘ │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
          │ HTTP/JSON
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                       │
│                                                                  │
│  ┌────────────────────────┐       ┌──────────────────────────┐  │
│  │  Cloudflare Worker     │◀─────▶│  D1 Database (SQLite)    │  │
│  │  (API + Routing)       │       │  - gist_analytics        │  │
│  │                        │       │  - stored_gists          │  │
│  └────────┬───────────────┘       └──────────────────────────┘  │
│           │                                                      │
│           │ Fetch                                                │
│           ▼                                                      │
│  ┌────────────────────────┐                                     │
│  │  Static Assets (dist)  │                                     │
│  │  - index.html          │                                     │
│  │  - CSS, JS bundles     │                                     │
│  └────────────────────────┘                                     │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ External API
                           ▼
                  ┌─────────────────────┐
                  │  GitHub Gist API    │
                  │  (gist content)     │
                  └─────────────────────┘
```

---

## Frontend Architecture

### Component Hierarchy

```
App.tsx (Root)
├── LandingPage.tsx (/)
│   ├── Hero section
│   ├── How it works
│   ├── Recent gists list
│   └── Popular gists list
│
└── GistRenderer.tsx (/{gist-id} or /share/{share-id})
    ├── Navigation header (with scroll behavior)
    ├── ShareableLink component (if applicable)
    └── Sandpack component (isolated React renderer)
```

### Routing

Client-side routing using browser history API:

```
┌─────────────────────────────────────────────────────────┐
│  URL Pattern              │  Component      │  API Call │
├───────────────────────────┼─────────────────┼───────────┤
│  /                        │  LandingPage    │  -        │
│  /{gist-id}               │  GistRenderer   │  /{id}    │
│  /share/{shareId}         │  GistRenderer   │  /share/  │
└─────────────────────────────────────────────────────────┘
```

### State Management

No global state library - uses React hooks:
- `useState` for local component state
- `useEffect` for data fetching and side effects
- `useRef` for DOM references and scroll tracking

---

## Backend Architecture

### Cloudflare Worker Routes

The worker (`worker/index.ts`) handles all incoming requests:

```
Request Flow:
┌──────────────────────────────────────────────────────────────┐
│  Incoming Request                                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │  Route Matcher          │
           └─────────────────────────┘
                         │
        ┌────────────────┼────────────────────┐
        │                │                    │
        ▼                ▼                    ▼
   ┌─────────┐    ┌──────────┐     ┌──────────────────┐
   │  /api/* │    │ /{gist}  │     │  /share/{id}     │
   └─────────┘    └──────────┘     └──────────────────┘
        │                │                    │
        ▼                ▼                    ▼
   API Handler    Fetch GitHub       Fetch from D1
                  + Store D1         + Update access
```

### API Endpoints

| Endpoint | Method | Purpose | Database |
|----------|--------|---------|----------|
| `/api/recent` | GET | Get recently accessed gists | Read `gist_analytics` |
| `/api/popular` | GET | Get most viewed gists | Read `gist_analytics` |
| `/api/update-share-id` | POST | Update custom share link | Update `stored_gists` |
| `/proxy?url=` | GET | CORS proxy for external requests | - |
| `/{gist-id}` | GET | Fetch gist from GitHub | Write `gist_analytics` |
| `/share/{share-id}` | GET | Fetch stored gist | Read/Update `stored_gists` |

---

## Database Schema

### Tables

**gist_analytics**
Tracks views and errors for each gist component:

```sql
CREATE TABLE gist_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gist_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    first_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 1,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    UNIQUE(gist_id, filename)
);

-- Indexes for performance
CREATE INDEX idx_gist_analytics_gist_id ON gist_analytics(gist_id);
CREATE INDEX idx_gist_analytics_last_accessed ON gist_analytics(last_accessed_at DESC);
CREATE INDEX idx_gist_analytics_view_count ON gist_analytics(view_count DESC);
CREATE INDEX idx_gist_analytics_first_accessed ON gist_analytics(first_accessed_at DESC);
```

**stored_gists**
Stores component content for shareable links:

```sql
CREATE TABLE stored_gists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id TEXT UNIQUE NOT NULL,      -- Custom shareable ID (e.g., "my-component")
    original_gist_id TEXT NOT NULL,     -- Original GitHub gist ID
    filename TEXT NOT NULL,
    content TEXT NOT NULL,              -- Cached component source code
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

-- Indexes for lookups
CREATE INDEX idx_stored_gists_share_id ON stored_gists(share_id);
CREATE INDEX idx_stored_gists_original_gist_id ON stored_gists(original_gist_id);
```

### Data Flow

```
┌─────────────┐
│ User visits │
│  /{gist-id} │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Worker fetches from     │
│ GitHub Gist API         │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ INSERT/UPDATE           │
│ gist_analytics          │
│ (increment view_count)  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Generate share_id       │
│ INSERT stored_gists     │
│ (if not exists)         │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Return JSON to client:  │
│ {content, filename,     │
│  gistId, shareId}       │
└─────────────────────────┘
```

---

## Component Rendering Pipeline

### AST-Based Component Detection

Before rendering, the system uses TypeScript AST parsing to detect React components:

**File**: `src/utils/astComponentDetector.ts`

```
Raw TSX Code from Gist
         │
         ▼
┌─────────────────────────┐
│  AST Parser             │
│  (Regex patterns)       │
└─────────┬───────────────┘
          │
          ▼
    Detect patterns:
    ✓ export default function ComponentName()
    ✓ export function ComponentName()
    ✓ const ComponentName = () => { ... }
    ✓ function ComponentName()
          │
          ▼
┌─────────────────────────┐
│ Extract component name  │
│ "MyComponent"           │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ Ensure default export   │
│ (add if missing)        │
└─────────────────────────┘
```

### Sandpack Rendering

ReactDrop uses CodeSandbox's Sandpack for secure, isolated component execution:

```
┌──────────────────────────────────────────────────────────┐
│                    GistRenderer.tsx                       │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Sandpack Component                                │  │
│  │                                                    │  │
│  │  Files:                                            │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │ ComponentName.tsx                            │ │  │
│  │  │ (original gist code + default export)        │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │ App.tsx                                      │ │  │
│  │  │ import ComponentName from './ComponentName'  │ │  │
│  │  │ export default () => <ComponentName />       │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  │                                                    │  │
│  │  Dependencies: (all allowed libraries)            │  │
│  │  - lucide-react, @radix-ui/*, lodash, etc.       │  │
│  │                                                    │  │
│  │  External Resources:                              │  │
│  │  - https://cdn.tailwindcss.com                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │  Sandpack Preview        │
              │  (Isolated iframe)       │
              │                          │
              │  - Bundled in browser    │
              │  - Runs in sandbox       │
              │  - No access to parent   │
              └──────────────────────────┘
```

**Security Features:**
- Component runs in isolated iframe (different origin)
- Fetch/XMLHttpRequest overridden to use `/proxy` endpoint
- Only allow-listed npm packages can be imported
- No access to parent window or DOM
- Tailwind CSS loaded via CDN (not bundled)

---

## Shareable Links System

### Share ID Generation & Collision Detection

```
┌────────────────────────────────────────────────────────┐
│  User views gist /{gist-id}                            │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │ Check if already stored:    │
        │ SELECT share_id FROM        │
        │   stored_gists WHERE        │
        │   original_gist_id = ?      │
        └──────────┬──────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    [EXISTS]            [NOT EXISTS]
         │                   │
         ▼                   ▼
   Return existing    Generate random ID:
   share_id           - 8 chars: [a-z0-9]
                      - Check collision
                      - Retry up to 10x
                      │
                      ▼
                INSERT INTO stored_gists
                (share_id, original_gist_id,
                 filename, content, description)
                      │
                      ▼
                Return new share_id
```

### Custom Share ID Update

Users can customize their share link:

```
┌────────────────────────────────────────────────────────┐
│  User clicks "Edit" on shareable link                  │
│  Enters custom name: "my-awesome-component"            │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │ Validate custom name:        │
        │ - Min 3 chars                │
        │ - Max 50 chars               │
        │ - [a-zA-Z0-9-_] only         │
        └──────────┬──────────────────┘
                   │
                   ▼
        ┌─────────────────────────────┐
        │ Check collision:             │
        │ SELECT * FROM stored_gists  │
        │   WHERE share_id = ?         │
        └──────────┬──────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    [COLLISION]         [AVAILABLE]
         │                   │
         ▼                   ▼
   Return error        UPDATE stored_gists
   409 Conflict        SET share_id = ?
                       WHERE original_gist_id = ?
                         AND filename = ?
                         AND share_id = ?
                       │
                       ▼
                  Return success
                  Client updates URL
```

---

## Testing Architecture

### Test Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← Playwright (4 browsers)
                    │   (Slowest)     │     Real browser automation
                    └────────┬────────┘
                             │
                 ┌───────────┴───────────┐
                 │  Integration Tests    │  ← Miniflare (SQLite)
                 │  (Medium Speed)       │     Real D1 queries
                 └──────────┬────────────┘
                            │
            ┌───────────────┴───────────────┐
            │      Unit Tests                │  ← Vitest (jsdom)
            │      (Fastest)                 │     Mock dependencies
            └────────────────────────────────┘
```

### Miniflare Integration Testing Architecture

**Miniflare** is a local simulator for Cloudflare Workers that provides production-like testing without deployment.

```
┌─────────────────────────────────────────────────┐
│           Miniflare Instance (Node.js)          │
│                                                 │
│  ┌──────────────┐         ┌─────────────────┐ │
│  │ Worker Code  │────────▶│  D1 Database    │ │
│  │ (JavaScript) │         │  (SQLite)       │ │
│  │              │         │                 │ │
│  │ - API routes │         │  In-Memory      │ │
│  │ - D1 queries │         │  Ephemeral      │ │
│  │ - Logic      │         │  Real SQL       │ │
│  └──────┬───────┘         └─────────────────┘ │
│         │                         │            │
│         │                         │            │
│  ┌──────▼──────────────────────────▼─────────┐ │
│  │        Cloudflare APIs Emulation          │ │
│  │  • env.DB (D1 Database binding)           │ │
│  │  • Request/Response objects               │ │
│  │  • Headers, URL parsing                   │ │
│  │  • Service bindings (ASSETS)              │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
                    ▲
                    │ mf.dispatchFetch(url, options)
                    │ (No HTTP overhead - direct calls)
                    │
            ┌───────┴────────┐
            │  Vitest Tests  │
            │                │
            │  beforeAll:    │
            │  - Create MF   │
            │  - Init schema │
            │                │
            │  beforeEach:   │
            │  - Clean DB    │
            │                │
            │  Test cases:   │
            │  - Dispatch    │
            │  - Assert      │
            └────────────────┘
```

### Two Testing Approaches

#### 1. Mock Approach (`worker-functions.test.ts`)

Fast unit tests with custom D1 mock:

```javascript
// In-memory JavaScript mock
const mockDatabase = {
  gist_analytics: [],
  stored_gists: []
}

// Mock D1 API
const mockDB = {
  prepare: (query) => ({
    bind: (...values) => ({
      first: async () => { /* find in array */ },
      all: async () => { /* filter/sort array */ },
      run: async () => { /* push to array */ }
    })
  })
}
```

**Pros**: ⚡ Ultra-fast, no dependencies
**Cons**: ⚠️ Doesn't test SQL syntax

#### 2. Miniflare Approach (`worker-integration.test.ts`)

High-fidelity tests with real SQLite:

```javascript
// Real Miniflare instance
mf = new Miniflare({
  modules: true,
  script: testWorker,
  d1Databases: ['DB'],      // Creates real SQLite DB
  d1Persist: false,         // Ephemeral (destroyed after)
  compatibilityDate: '2025-01-20'
})

// Real requests to worker
const response = await mf.dispatchFetch('http://localhost/api/recent')
const data = await response.json()
```

**Pros**: ✅ Production-like, tests real SQL, catches edge cases
**Cons**: ⚠️ Slightly slower (~600ms total)

### Test Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│  beforeAll()                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  1. Read schema.sql file                         │   │
│  │  2. Create Miniflare instance                    │   │
│  │     - Initialize worker script                   │   │
│  │     - Create ephemeral D1 database (SQLite)      │   │
│  │     - Setup service bindings (ASSETS mock)       │   │
│  │  3. Wait for Miniflare ready                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  beforeEach()                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  1. Initialize schema:                           │   │
│  │     POST /api/init-schema                        │   │
│  │     (CREATE TABLE IF NOT EXISTS...)              │   │
│  │                                                   │   │
│  │  2. Clean database:                              │   │
│  │     POST /api/cleanup                            │   │
│  │     (DELETE FROM gist_analytics)                 │   │
│  │     (DELETE FROM stored_gists)                   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Test Case (example)                                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  1. Dispatch fetch to worker:                    │   │
│  │     GET /abc123                                  │   │
│  │                                                   │   │
│  │  2. Worker processes request:                    │   │
│  │     - Fetch from GitHub (mocked)                 │   │
│  │     - INSERT INTO gist_analytics                 │   │
│  │     - Generate share_id                          │   │
│  │     - Return JSON                                │   │
│  │                                                   │   │
│  │  3. Assert response:                             │   │
│  │     expect(response.status).toBe(200)            │   │
│  │     expect(data.content).toContain('Component')  │   │
│  │                                                   │   │
│  │  4. Verify database:                             │   │
│  │     GET /api/recent                              │   │
│  │     expect(records[0].view_count).toBe(1)        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  afterAll()                                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  1. Dispose Miniflare instance                   │   │
│  │  2. Destroy ephemeral database                   │   │
│  │  3. Clean up resources                           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Why Miniflare?

| Benefit | Description |
|---------|-------------|
| **No Network** | Tests run locally, no Cloudflare API calls needed |
| **No Cost** | Free, unlimited test runs without deploying |
| **No Cleanup** | Ephemeral databases destroyed automatically |
| **Fast Feedback** | Full integration test suite in ~600ms |
| **CI-Friendly** | Works in GitHub Actions, no external dependencies |
| **High Fidelity** | Real SQLite matches D1 behavior in production |
| **Real SQL** | Catches SQL syntax errors and query bugs |
| **ACID Transactions** | Proper database semantics |
| **Indexes Work** | Performance characteristics match production |

### Test Coverage

- **Unit Tests**: React components, utility functions, component detection
- **Integration Tests**: Worker functions, D1 database operations, analytics, shareable links
- **E2E Tests**: User flows, navigation, gist rendering (Playwright across 4 browsers)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Developer Machine                                          │
│                                                             │
│  1. pnpm build                                              │
│     ├─ tsc -b (TypeScript compilation)                     │
│     └─ vite build (Bundle React app)                       │
│         └─ Output: dist/client/                            │
│                                                             │
│  2. pnpm deploy (or wrangler deploy)                       │
│     ├─ Upload worker script                                │
│     ├─ Upload static assets                                │
│     └─ Bind to D1 database                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Edge Network (Global)                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Worker (runs at edge, close to users)              │  │
│  │  - Routes requests                                   │  │
│  │  - Serves static assets                             │  │
│  │  - Processes API calls                              │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                         │
│                   ▼                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  D1 Database (SQLite, replicated at edge)           │  │
│  │  - gist_analytics                                    │  │
│  │  - stored_gists                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
               ┌──────────────────┐
               │   End Users      │
               │   (Global)       │
               └──────────────────┘
```

**Key Points:**
- Worker runs at Cloudflare's edge (200+ locations worldwide)
- D1 database replicates to edge locations for low latency
- Static assets served from CDN
- No traditional server infrastructure needed
- Auto-scaling built-in
- Cold starts ~0ms (Workers are pre-warmed)

---

## Performance Optimizations

### Database Indexing

All frequently queried columns are indexed:
- `gist_analytics`: Indexed by `gist_id`, `last_accessed_at`, `view_count`, `first_accessed_at`
- `stored_gists`: Indexed by `share_id`, `original_gist_id`

### Caching Strategy

**No caching** - intentional design choice:
- Always fetch fresh content from GitHub
- Ensures latest version is displayed
- Tradeoff: Slightly slower initial load vs. always up-to-date

### Component Rendering

- Sandpack bundles in browser (no server-side bundling)
- Tailwind CSS loaded once from CDN
- Dependencies loaded from npm CDN (Sandpack handles)
- Preview iframe isolated for security and performance

### Mobile Optimizations

- Responsive header that hides on scroll down
- Compact shareable link component on mobile
- Touch-friendly buttons and inputs
- Viewport properly configured for mobile devices

---

## Security Considerations

### Sandboxed Execution

Components run in isolated iframe:
- Different origin (cross-origin isolation)
- No access to parent window
- No access to cookies or localStorage outside sandbox
- Fetch/XHR intercepted and routed through proxy

### Input Validation

- Share ID format: `[a-zA-Z0-9-_]{3,50}`
- SQL injection prevented by prepared statements with bound parameters
- GitHub API responses validated before processing

### CORS Proxy

External API calls routed through `/proxy` endpoint:
- Prevents CORS issues
- Adds `Access-Control-Allow-Origin: *` header
- Prevents direct external network access from components

### Content Security Policy

Configured in `index.html`:
- Allows Sandpack iframes from `*.codesandbox.io`
- Allows inline scripts (required for Vite)
- Allows HTTPS resources

---

## Future Enhancements

Potential architectural improvements:

1. **Caching Layer**: Add Redis/KV cache for GitHub responses
2. **Rate Limiting**: Implement per-IP rate limits on API endpoints
3. **Authentication**: Add user accounts for managing shareable links
4. **Analytics Dashboard**: Real-time charts for gist popularity
5. **Component Versioning**: Track and allow viewing previous versions
6. **Search**: Full-text search across component descriptions
7. **Preview Images**: Generate screenshots for social sharing
8. **Custom Domains**: Allow users to map custom domains to shareable links

---

## References

- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Cloudflare D1**: https://developers.cloudflare.com/d1/
- **Miniflare**: https://miniflare.dev/
- **Sandpack**: https://sandpack.codesandbox.io/
- **Vite**: https://vitejs.dev/
- **React 19**: https://react.dev/
