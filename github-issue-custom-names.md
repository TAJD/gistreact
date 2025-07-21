# Feature Request: Custom Component Names with Clean URLs

## 🎯 Overview
Enable users to assign custom names to their components, creating clean, memorable URLs like `gistreact.com/my-awesome-button` instead of cryptic gist IDs.

## 📋 Requirements

### User Stories
- **As a developer**, I want to give my components descriptive names so they're easier to share and remember
- **As a user**, I want to visit clean URLs that tell me what the component is about
- **As a content creator**, I want professional-looking URLs for portfolio pieces and client demos

### Success Criteria
- ✅ Users can assign custom names when submitting gists
- ✅ System generates unique, SEO-friendly slugs
- ✅ Clean URLs work: `gistreact.com/my-button-component`
- ✅ Backward compatibility maintained for existing gist ID URLs
- ✅ Duplicate name handling with graceful fallbacks

## 🏗️ Technical Implementation Plan

### 1. Database Schema Changes
```sql
-- Add custom naming support to existing table
ALTER TABLE gist_analytics ADD COLUMN custom_name TEXT;
ALTER TABLE gist_analytics ADD COLUMN slug TEXT UNIQUE;
CREATE INDEX idx_gist_analytics_slug ON gist_analytics(slug);

-- Migration for existing records
UPDATE gist_analytics 
SET slug = gist_id 
WHERE slug IS NULL;
```

### 2. Frontend Changes

#### Landing Page Enhancement
**File:** `src/components/LandingPage.tsx`
- Add optional "Component Name" input field to `GistUrlInput` component
- Implement real-time slug preview
- Add validation for name format and length

```typescript
interface GistSubmission {
  gistUrl: string;
  customName?: string;
}

const generateSlugPreview = (name: string) => {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
};
```

#### URL Display
- Show generated custom URL to user after successful submission
- Provide copy-to-clipboard functionality
- Display both custom URL and fallback gist ID URL

### 3. Backend Changes

#### Worker Route Handling
**File:** `worker/index.ts`
- Add slug-based route matching before gist ID matching
- Implement slug-to-gist-ID lookup
- Handle slug conflicts with incremental suffixes

```typescript
// New route handler (add before gist ID handler)
const slug = path.slice(1); // Remove leading slash
if (slug && slug.match(/^[a-z0-9-]+$/) && !isGistId(slug)) {
  const component = await getComponentBySlug(env, slug);
  if (component) {
    // Render component using existing logic
  }
}

// Support functions
async function getComponentBySlug(env: Env, slug: string) {
  const result = await env.DB.prepare(`
    SELECT gist_id, filename 
    FROM gist_analytics 
    WHERE slug = ?
  `).bind(slug).first();
  
  if (result) {
    return await fetchGistComponent(result.gist_id, env);
  }
  return null;
}

async function saveComponentWithName(env: Env, gistId: string, filename: string, customName?: string) {
  let slug = gistId; // Default to gist ID
  
  if (customName) {
    const baseSlug = generateSlug(customName);
    slug = await findUniqueSlug(env, baseSlug);
  }
  
  // Update existing analytics record or create new one
  await env.DB.prepare(`
    UPDATE gist_analytics 
    SET custom_name = ?, slug = ?
    WHERE gist_id = ? AND filename = ?
  `).bind(customName, slug, gistId, filename).run();
  
  return { slug, customName };
}

function generateSlug(name: string): string {
  return name.toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
    .substring(0, 50);            // Limit length
}

async function findUniqueSlug(env: Env, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  
  while (await slugExists(env, slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}
```

### 4. API Changes

#### New Endpoint: Submit Component with Name
```typescript
// POST /api/component
{
  gistUrl: string;
  customName?: string;
}

// Response
{
  slug: string;
  customUrl: string;
  fallbackUrl: string;
  customName?: string;
}
```

## 🎨 User Experience Flow

### Submission Flow
1. **User visits landing page**
2. **User enters gist URL and optional component name**
   ```
   Gist URL: https://gist.github.com/user/abc123def456
   Component Name: My Awesome Button (optional)
   ```
3. **System processes submission:**
   - Validates gist exists and has .tsx file
   - Generates unique slug from name or uses gist ID
   - Stores mapping in database
   - Returns custom URL
4. **User receives confirmation:**
   ```
   ✅ Component hosted successfully!
   Your component is available at:
   🔗 https://gistreact.com/my-awesome-button
   📋 [Copy Link]
   
   Fallback URL: https://gistreact.com/abc123def456
   ```

### URL Access Flow
1. **User/visitor accesses custom URL:** `gistreact.com/my-awesome-button`
2. **System looks up slug in database**
3. **System fetches component using mapped gist ID**
4. **Component renders normally**

## 🔧 Implementation Phases

### Phase 1: Core Functionality (Week 1)
- [ ] Database schema updates and migration
- [ ] Basic slug generation and uniqueness handling
- [ ] Frontend form enhancement with name input
- [ ] Backend slug-based routing
- [ ] Custom URL generation and display

### Phase 2: Enhanced UX (Week 2)
- [ ] Real-time slug preview in form
- [ ] Name validation and suggestions
- [ ] Bulk migration tool for existing components
- [ ] Analytics integration for custom names
- [ ] SEO optimization (meta tags, structured data)

### Phase 3: Advanced Features (Week 3)
- [ ] Name editing capability for existing components
- [ ] Component search by name
- [ ] Popular names/trending components
- [ ] Custom domain support preparation
- [ ] Admin tools for slug management

## 🧪 Testing Strategy

### Unit Tests
- Slug generation logic with edge cases
- Uniqueness checking and conflict resolution
- Input validation and sanitization

### Integration Tests
- Complete submission flow with custom names
- URL routing for both slugs and gist IDs
- Database operations and migrations

### Manual Testing
- Submit components with various name formats
- Test slug conflicts and resolution
- Verify backward compatibility
- Mobile responsiveness of new form fields

## 📊 Success Metrics

### Technical Metrics
- [ ] 100% backward compatibility maintained
- [ ] < 200ms additional response time for slug lookups
- [ ] 0% slug collision failures

### User Metrics
- [ ] % of submissions using custom names
- [ ] Reduction in URL sharing friction
- [ ] Increased component discoverability

## 🚨 Risks & Mitigations

### Technical Risks
- **Slug conflicts**: Implement robust uniqueness checking with fallbacks
- **Database migration**: Test thoroughly on development environment
- **Performance impact**: Index slug column and optimize queries

### UX Risks
- **Complex form**: Keep name field optional and clearly labeled
- **Broken links**: Maintain permanent redirects and clear fallback strategy
- **SEO impact**: Ensure proper canonicalization and redirects

## 📝 Acceptance Criteria

- [ ] Users can optionally provide custom names when submitting gists
- [ ] System generates unique, URL-safe slugs from custom names
- [ ] Clean URLs work: `gistreact.com/my-component-name`
- [ ] Original gist ID URLs continue to work without changes
- [ ] Duplicate name handling works gracefully with automatic suffixes
- [ ] Mobile-responsive form design
- [ ] Real-time slug preview functionality
- [ ] Copy-to-clipboard for generated URLs
- [ ] Database migration script tested and ready
- [ ] Comprehensive test coverage for new functionality

## 🔗 Related Issues
- Improved SEO and social sharing (#TBD)
- Component discovery and search (#TBD)
- Analytics dashboard enhancement (#TBD)

## 🏷️ Labels
`enhancement` `ux-improvement` `database` `routing` `seo`

---

**Estimated Effort:** 2-3 weeks
**Priority:** Medium-High
**Complexity:** Medium