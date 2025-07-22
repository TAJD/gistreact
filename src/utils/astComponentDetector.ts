interface ComponentInfo {
  name: string
  isExported: boolean
  isDefault: boolean
  type: 'function' | 'arrow' | 'class'
}

export function detectReactComponents(code: string): ComponentInfo[] {
  const components: ComponentInfo[] = []
  const componentNames = new Set<string>()

  // Enhanced regex patterns to detect React components
  const patterns = [
    // export default function ComponentName()
    {
      regex: /export\s+default\s+function\s+([A-Z][a-zA-Z0-9_]*)\s*\(/g,
      type: 'function' as const,
      isExported: true,
      isDefault: true
    },
    // export function ComponentName()
    {
      regex: /export\s+function\s+([A-Z][a-zA-Z0-9_]*)\s*\(/g,
      type: 'function' as const,
      isExported: true,
      isDefault: false
    },
    // function ComponentName()
    {
      regex: /(?:^|\n)\s*function\s+([A-Z][a-zA-Z0-9_]*)\s*\(/g,
      type: 'function' as const,
      isExported: false,
      isDefault: false
    },
    // const ComponentName = () =>
    {
      regex: /const\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*\([^)]*\)\s*=>/g,
      type: 'arrow' as const,
      isExported: false,
      isDefault: false
    },
    // const ComponentName = function
    {
      regex: /const\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*function/g,
      type: 'function' as const,
      isExported: false,
      isDefault: false
    },
    // export default class ComponentName
    {
      regex: /export\s+default\s+class\s+([A-Z][a-zA-Z0-9_]*)/g,
      type: 'class' as const,
      isExported: true,
      isDefault: true
    },
    // class ComponentName
    {
      regex: /(?:^|\n)\s*class\s+([A-Z][a-zA-Z0-9_]*)/g,
      type: 'class' as const,
      isExported: false,
      isDefault: false
    }
  ]

  // Find all components using regex patterns
  for (const pattern of patterns) {
    let match
    while ((match = pattern.regex.exec(code)) !== null) {
      const name = match[1]
      if (!componentNames.has(name)) {
        componentNames.add(name)
        components.push({
          name,
          isExported: pattern.isExported,
          isDefault: pattern.isDefault,
          type: pattern.type
        })
      } else {
        // Update existing component info if this pattern has better export info
        const existing = components.find(c => c.name === name)
        if (existing && pattern.isExported && !existing.isExported) {
          existing.isExported = pattern.isExported
          existing.isDefault = pattern.isDefault
        }
      }
    }
  }

  // Check for export default statements that reference existing components
  const exportDefaultMatch = code.match(/export\s+default\s+([A-Z][a-zA-Z0-9_]*)\s*[;\n]/)
  if (exportDefaultMatch) {
    const name = exportDefaultMatch[1]
    const existing = components.find(c => c.name === name)
    if (existing) {
      existing.isExported = true
      existing.isDefault = true
    } else if (componentNames.has(name)) {
      components.push({
        name,
        isExported: true,
        isDefault: true,
        type: 'function'
      })
    }
  }

  // Check for named exports
  const namedExportMatches = [...code.matchAll(/export\s*\{\s*([^}]+)\s*\}/g)]
  for (const match of namedExportMatches) {
    const exportList = match[1]
    const exportNames = exportList.split(',').map(s => s.trim()).filter(s => /^[A-Z]/.test(s))
    
    for (const name of exportNames) {
      const cleanName = name.replace(/\s+as\s+.*/, '').trim()
      const existing = components.find(c => c.name === cleanName)
      if (existing) {
        existing.isExported = true
      }
    }
  }

  return components
}

export function getMainReactComponent(code: string): string | null {
  const components = detectReactComponents(code)
  
  if (components.length === 0) {
    return null
  }

  // Priority order:
  // 1. Default exported component
  // 2. Any exported component
  // 3. First component found (uppercase naming convention)
  
  const defaultExported = components.find(c => c.isDefault)
  if (defaultExported) {
    return defaultExported.name
  }

  const exported = components.find(c => c.isExported)
  if (exported) {
    return exported.name
  }

  // Return the first component (likely the main one)
  return components[0]?.name || null
}