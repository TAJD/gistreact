import { describe, it, expect } from 'vitest'
import { validateComponent } from './componentValidator'

describe('validateComponent', () => {
  describe('Valid component', () => {
    it('should pass all checks for a valid React component', () => {
      const code = `
import React from 'react'
import { Dialog } from '@radix-ui/react-dialog'

export default function MyComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      expect(result.isDeployable).toBe(true)
      expect(result.componentName).toBe('MyComponent')
      expect(result.checks.every(c => c.status === 'pass')).toBe(true)
    })
  })

  describe('Code size check', () => {
    it('should fail when code exceeds 50KB', () => {
      const largeCode = 'const x = "' + 'x'.repeat(51 * 1024) + '"'
      const result = validateComponent(largeCode)
      const sizeCheck = result.checks.find(c => c.id === 'size')
      expect(sizeCheck?.status).toBe('fail')
      expect(result.isDeployable).toBe(false)
    })

    it('should pass when code is under 50KB', () => {
      const code = `
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const sizeCheck = result.checks.find(c => c.id === 'size')
      expect(sizeCheck?.status).toBe('pass')
    })
  })

  describe('Component detection', () => {
    it('should fail when no component is found', () => {
      const code = 'const x = 5; const y = 10;'
      const result = validateComponent(code)
      const componentCheck = result.checks.find(c => c.id === 'component')
      expect(componentCheck?.status).toBe('fail')
      expect(result.isDeployable).toBe(false)
    })

    it('should pass when a function component is found', () => {
      const code = `
function MyComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const componentCheck = result.checks.find(c => c.id === 'component')
      expect(componentCheck?.status).toBe('pass')
    })

    it('should pass when an arrow component is found', () => {
      const code = `
const MyComponent = () => <div>Hello</div>
`
      const result = validateComponent(code)
      const componentCheck = result.checks.find(c => c.id === 'component')
      expect(componentCheck?.status).toBe('pass')
    })

    it('should detect multiple components', () => {
      const code = `
export default function MainComponent() {
  return <div><SubComponent /></div>
}

function SubComponent() {
  return <span>Sub</span>
}
`
      const result = validateComponent(code)
      const componentCheck = result.checks.find(c => c.id === 'component')
      expect(componentCheck?.status).toBe('pass')
      expect(componentCheck?.message).toContain('2 components')
    })
  })

  describe('Default export', () => {
    it('should warn when no default export exists but component is found', () => {
      const code = `
function MyComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const exportCheck = result.checks.find(c => c.id === 'export')
      expect(exportCheck?.status).toBe('warn')
      expect(exportCheck?.message).toContain('auto-add')
    })

    it('should pass when default export is present', () => {
      const code = `
export default function MyComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const exportCheck = result.checks.find(c => c.id === 'export')
      expect(exportCheck?.status).toBe('pass')
    })

    it('should fail when no default export and no component found', () => {
      const code = 'const x = 5;'
      const result = validateComponent(code)
      const exportCheck = result.checks.find(c => c.id === 'export')
      expect(exportCheck?.status).toBe('fail')
      expect(result.isDeployable).toBe(false)
    })
  })

  describe('Forbidden imports', () => {
    it('should fail when fs module is imported', () => {
      const code = `
import fs from 'fs'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('fail')
      expect(forbiddenCheck?.message).toContain('fs')
      expect(result.isDeployable).toBe(false)
    })

    it('should fail when path module is imported', () => {
      const code = `
import path from 'path'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('fail')
      expect(forbiddenCheck?.message).toContain('path')
    })

    it('should fail when child_process module is imported', () => {
      const code = `
import { exec } from 'child_process'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('fail')
      expect(forbiddenCheck?.message).toContain('child_process')
    })

    it('should fail when node: prefixed modules are imported', () => {
      const code = `
import fs from 'node:fs'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('fail')
    })

    it('should pass when no forbidden imports are present', () => {
      const code = `
import React from 'react'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('pass')
    })

    it('should detect multiple forbidden imports', () => {
      const code = `
import fs from 'fs'
import path from 'path'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('fail')
      expect(forbiddenCheck?.message).toContain('fs')
      expect(forbiddenCheck?.message).toContain('path')
    })
  })

  describe('Allowed imports (allowlist)', () => {
    it('should pass when React is imported', () => {
      const code = `
import React from 'react'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should pass when lodash is imported', () => {
      const code = `
import { debounce } from 'lodash'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should pass when lucide-react is imported', () => {
      const code = `
import { Button } from 'lucide-react'
export default function App() {
  return <Button>Click</Button>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should pass when @radix-ui packages are imported', () => {
      const code = `
import { Dialog } from '@radix-ui/react-dialog'
export default function App() {
  return <div>Click</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should pass when date-fns is imported', () => {
      const code = `
import { format } from 'date-fns'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should fail when unsupported library is imported', () => {
      const code = `
import axios from 'axios'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('fail')
      expect(allowlistCheck?.message).toContain('axios')
      expect(result.isDeployable).toBe(false)
    })

    it('should fail when multiple unsupported libraries are imported', () => {
      const code = `
import axios from 'axios'
import lodashCustom from 'lodash-custom'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('fail')
    })

    it('should pass relative imports', () => {
      const code = `
import { helper } from './utils'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should pass with no external imports', () => {
      const code = `
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
      expect(allowlistCheck?.message).toContain('No external imports')
    })
  })

  describe('Empty code', () => {
    it('should return null for processedCode when code is empty', () => {
      const result = validateComponent('')
      expect(result.processedCode).toBeNull()
      expect(result.componentName).toBeNull()
    })
  })

  describe('Processed code', () => {
    it('should add default export when missing', () => {
      const code = `
function MyComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      expect(result.processedCode).toContain('export default MyComponent')
      expect(result.isDeployable).toBe(true)
    })

    it('should not modify code when default export exists', () => {
      const code = `
export default function MyComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      expect(result.processedCode).toBe(code)
    })

    it('should be null when component is not deployable', () => {
      const code = `
import fs from 'fs'
function MyComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      expect(result.processedCode).toBeNull()
    })
  })

  describe('Component name detection', () => {
    it('should return the component name', () => {
      const code = `
export default function MySpecialComponent() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      expect(result.componentName).toBe('MySpecialComponent')
    })

    it('should return first component name when multiple exist', () => {
      const code = `
export default function MainComponent() {
  return <SubComponent />
}

function SubComponent() {
  return <div>Sub</div>
}
`
      const result = validateComponent(code)
      expect(result.componentName).toBe('MainComponent')
    })

    it('should return null when no component exists', () => {
      const code = 'const x = 5'
      const result = validateComponent(code)
      expect(result.componentName).toBeNull()
    })
  })

  describe('Multiple components detection', () => {
    it('should detect multiple components in message', () => {
      const code = `
function ComponentOne() { return <div>One</div> }
function ComponentTwo() { return <div>Two</div> }
export default ComponentOne
`
      const result = validateComponent(code)
      const componentCheck = result.checks.find(c => c.id === 'component')
      expect(componentCheck?.message).toContain('2 components')
    })

    it('should list all component names', () => {
      const code = `
function FirstComponent() { return <div>One</div> }
function SecondComponent() { return <div>Two</div> }
export default FirstComponent
`
      const result = validateComponent(code)
      const componentCheck = result.checks.find(c => c.id === 'component')
      expect(componentCheck?.message).toContain('FirstComponent')
      expect(componentCheck?.message).toContain('SecondComponent')
    })
  })

  describe('Complex scenarios', () => {
    it('should validate a complete real-world component', () => {
      const code = `
import React, { useState } from 'react'
import { Dialog } from '@radix-ui/react-dialog'
import { debounce } from 'lodash'

export default function Counter() {
  const [count, setCount] = useState(0)

  const handleClick = debounce(() => {
    setCount(count + 1)
  }, 300)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleClick}>Increment</button>
    </div>
  )
}
`
      const result = validateComponent(code)
      expect(result.isDeployable).toBe(true)
      expect(result.componentName).toBe('Counter')
      expect(result.checks.every(c => c.status !== 'fail')).toBe(true)
    })

    it('should catch multiple issues at once', () => {
      const code = `
import fs from 'fs'
import axios from 'axios'
const x = 'hello'
`
      const result = validateComponent(code)
      expect(result.isDeployable).toBe(false)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      const componentCheck = result.checks.find(c => c.id === 'component')
      expect(forbiddenCheck?.status).toBe('fail')
      expect(allowlistCheck?.status).toBe('fail')
      expect(componentCheck?.status).toBe('fail')
    })
  })

  describe('require() statements', () => {
    it('should detect imports from require() calls', () => {
      const code = `
const fs = require('fs')
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('fail')
    })

    it('should detect allowed dependencies from require()', () => {
      const code = `
const React = require('react')
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const forbiddenCheck = result.checks.find(c => c.id === 'forbidden')
      expect(forbiddenCheck?.status).toBe('pass')
    })
  })

  describe('Scoped packages', () => {
    it('should handle @radix-ui scoped packages correctly', () => {
      const code = `
import { Dialog } from '@radix-ui/react-dialog'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should reject unsupported scoped packages', () => {
      const code = `
import { Something } from '@unknown/react-package'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('fail')
    })
  })

  describe('Subpath imports', () => {
    it('should allow subpath imports from allowed packages', () => {
      const code = `
import { debounce } from 'lodash/debounce'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('pass')
    })

    it('should reject subpath imports from disallowed packages', () => {
      const code = `
import { something } from 'forbidden-pkg/subpath'
export default function App() {
  return <div>Hello</div>
}
`
      const result = validateComponent(code)
      const allowlistCheck = result.checks.find(c => c.id === 'allowlist')
      expect(allowlistCheck?.status).toBe('fail')
    })
  })
})
