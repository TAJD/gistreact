import { detectReactComponents, getMainReactComponent } from './astComponentDetector'

export interface ValidationCheck {
  id: string
  label: string
  status: 'pass' | 'fail' | 'warn'
  message: string
}

export interface ValidationResult {
  checks: ValidationCheck[]
  isDeployable: boolean
  componentName: string | null
  processedCode: string | null
}

const ALLOWED_DEPENDENCIES = new Set([
  'react', 'react-dom', 'react/jsx-runtime',
  'lucide-react', '@swc/helpers',
  '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog',
  '@radix-ui/react-aspect-ratio', '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox', '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu', '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu', '@radix-ui/react-hover-card',
  '@radix-ui/react-label', '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu', '@radix-ui/react-popover',
  '@radix-ui/react-progress', '@radix-ui/react-radio-group',
  '@radix-ui/react-scroll-area', '@radix-ui/react-select',
  '@radix-ui/react-separator', '@radix-ui/react-slider',
  '@radix-ui/react-slot', '@radix-ui/react-switch',
  '@radix-ui/react-tabs', '@radix-ui/react-toast',
  '@radix-ui/react-toggle', '@radix-ui/react-toggle-group',
  '@radix-ui/react-tooltip',
  'class-variance-authority', 'clsx', 'tailwind-merge',
  'date-fns', 'react-day-picker',
  'react-hook-form', '@hookform/resolvers', 'zod',
  'input-otp', 'embla-carousel-react', 'react-resizable-panels',
  'vaul', 'cmdk', 'sonner',
  'recharts', 'lodash', 'nanoid',
  'framer-motion', 'next-themes',
])

const FORBIDDEN_IMPORTS = new Set([
  'fs', 'path', 'child_process', 'os', 'net', 'http', 'https',
  'crypto', 'stream', 'cluster', 'dgram', 'dns', 'tls',
  'worker_threads', 'vm', 'process', 'buffer',
  'node:fs', 'node:path', 'node:child_process', 'node:os',
  'node:net', 'node:http', 'node:https', 'node:crypto',
])

const MAX_CODE_SIZE = 50 * 1024 // 50KB

function extractImports(code: string): string[] {
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s+['"]([^'"]+)['"]/g
  const imports: string[] = []
  let match
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1])
  }
  // Also catch require() calls
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = requireRegex.exec(code)) !== null) {
    imports.push(match[1])
  }
  return imports
}

function isRelativeImport(imp: string): boolean {
  return imp.startsWith('./') || imp.startsWith('../')
}

function getPackageName(imp: string): string {
  // Handle scoped packages like @radix-ui/react-dialog
  if (imp.startsWith('@')) {
    const parts = imp.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : imp
  }
  // Handle subpath imports like lodash/debounce
  return imp.split('/')[0]
}

export function validateComponent(code: string): ValidationResult {
  const checks: ValidationCheck[] = []
  let isDeployable = true

  // Check 1: Code size
  const codeSize = new TextEncoder().encode(code).length
  if (codeSize > MAX_CODE_SIZE) {
    checks.push({
      id: 'size',
      label: 'Code size',
      status: 'fail',
      message: `Code is ${Math.round(codeSize / 1024)}KB (max ${MAX_CODE_SIZE / 1024}KB)`,
    })
    isDeployable = false
  } else {
    checks.push({
      id: 'size',
      label: 'Code size',
      status: 'pass',
      message: `${Math.round(codeSize / 1024)}KB (max ${MAX_CODE_SIZE / 1024}KB)`,
    })
  }

  // Check 2: Component detection
  const components = detectReactComponents(code)
  if (components.length === 0) {
    checks.push({
      id: 'component',
      label: 'React component',
      status: 'fail',
      message: 'No React component found. Components must use PascalCase names.',
    })
    isDeployable = false
  } else {
    const mainComponent = getMainReactComponent(code)
    checks.push({
      id: 'component',
      label: 'React component',
      status: 'pass',
      message: `Found ${components.length} component${components.length > 1 ? 's' : ''}: ${components.map(c => c.name).join(', ')}. Main: ${mainComponent}`,
    })
  }

  // Check 3: Default export
  const hasDefaultExport = code.includes('export default')
  const componentName = getMainReactComponent(code)
  if (!hasDefaultExport) {
    if (componentName) {
      checks.push({
        id: 'export',
        label: 'Default export',
        status: 'warn',
        message: `No default export found. Will auto-add: export default ${componentName}`,
      })
    } else {
      checks.push({
        id: 'export',
        label: 'Default export',
        status: 'fail',
        message: 'No default export and no component found to auto-export.',
      })
      isDeployable = false
    }
  } else {
    checks.push({
      id: 'export',
      label: 'Default export',
      status: 'pass',
      message: 'Default export present',
    })
  }

  // Check 4: Forbidden imports
  const imports = extractImports(code)
  const forbiddenFound = imports.filter(imp => FORBIDDEN_IMPORTS.has(imp))
  if (forbiddenFound.length > 0) {
    checks.push({
      id: 'forbidden',
      label: 'Forbidden imports',
      status: 'fail',
      message: `Node.js modules not allowed: ${forbiddenFound.join(', ')}`,
    })
    isDeployable = false
  } else {
    checks.push({
      id: 'forbidden',
      label: 'Forbidden imports',
      status: 'pass',
      message: 'No forbidden imports detected',
    })
  }

  // Check 5: Import allowlist
  const externalImports = imports.filter(imp => !isRelativeImport(imp))
  const unsupported = externalImports.filter(imp => {
    const pkg = getPackageName(imp)
    return !ALLOWED_DEPENDENCIES.has(pkg) && !FORBIDDEN_IMPORTS.has(imp)
  })
  if (unsupported.length > 0) {
    checks.push({
      id: 'allowlist',
      label: 'Supported libraries',
      status: 'fail',
      message: `Unsupported: ${unsupported.map(i => getPackageName(i)).join(', ')}. Check the available dependencies list.`,
    })
    isDeployable = false
  } else {
    checks.push({
      id: 'allowlist',
      label: 'Supported libraries',
      status: 'pass',
      message: externalImports.length > 0
        ? `All imports supported: ${externalImports.map(i => getPackageName(i)).join(', ')}`
        : 'No external imports',
    })
  }

  // Build processed code for preview
  let processedCode: string | null = null
  if (isDeployable && componentName) {
    processedCode = code
    if (!hasDefaultExport) {
      processedCode = `${code}\n\nexport default ${componentName};`
    }
  }

  return { checks, isDeployable, componentName, processedCode }
}
