/**
 * Shared Sandpack dependency configuration.
 * Used by both GistRenderer and ValidatorPage.
 * Keep in sync with ALLOWED_DEPENDENCIES in componentValidator.ts.
 *
 * Note: Uses 'latest' because Sandpack's CDN bundler resolves packages
 * independently and may not have specific pinned versions cached.
 * The security boundary is the import allowlist in componentValidator.ts,
 * not the version pins here.
 */
export const SANDPACK_DEPENDENCIES: Record<string, string> = {
  'lucide-react': 'latest',
  '@swc/helpers': 'latest',
  '@radix-ui/react-accordion': 'latest',
  '@radix-ui/react-alert-dialog': 'latest',
  '@radix-ui/react-aspect-ratio': 'latest',
  '@radix-ui/react-avatar': 'latest',
  '@radix-ui/react-checkbox': 'latest',
  '@radix-ui/react-collapsible': 'latest',
  '@radix-ui/react-context-menu': 'latest',
  '@radix-ui/react-dialog': 'latest',
  '@radix-ui/react-dropdown-menu': 'latest',
  '@radix-ui/react-hover-card': 'latest',
  '@radix-ui/react-label': 'latest',
  '@radix-ui/react-menubar': 'latest',
  '@radix-ui/react-navigation-menu': 'latest',
  '@radix-ui/react-popover': 'latest',
  '@radix-ui/react-progress': 'latest',
  '@radix-ui/react-radio-group': 'latest',
  '@radix-ui/react-scroll-area': 'latest',
  '@radix-ui/react-select': 'latest',
  '@radix-ui/react-separator': 'latest',
  '@radix-ui/react-slider': 'latest',
  '@radix-ui/react-slot': 'latest',
  '@radix-ui/react-switch': 'latest',
  '@radix-ui/react-tabs': 'latest',
  '@radix-ui/react-toast': 'latest',
  '@radix-ui/react-toggle': 'latest',
  '@radix-ui/react-toggle-group': 'latest',
  '@radix-ui/react-tooltip': 'latest',
  'class-variance-authority': 'latest',
  'clsx': 'latest',
  'tailwind-merge': 'latest',
  'date-fns': 'latest',
  'react-day-picker': 'latest',
  'react-hook-form': 'latest',
  '@hookform/resolvers': 'latest',
  'zod': 'latest',
  'input-otp': 'latest',
  'embla-carousel-react': 'latest',
  'react-resizable-panels': 'latest',
  'vaul': 'latest',
  'cmdk': 'latest',
  'sonner': 'latest',
  'recharts': 'latest',
  'lodash': 'latest',
  'nanoid': 'latest',
  'framer-motion': 'latest',
  'next-themes': 'latest',
}

// Note: SRI cannot be applied to externalResources - they load inside the Sandpack iframe
// which has its own CSP. The proxy domain allowlist in worker/index.ts provides protection.
export const SANDPACK_EXTERNAL_RESOURCES = [
  'https://cdn.tailwindcss.com',
]
