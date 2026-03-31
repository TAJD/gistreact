import { describe, it, expect } from 'vitest'
import { detectReactComponents, getMainReactComponent } from './astComponentDetector'

describe('astComponentDetector', () => {
  describe('detectReactComponents', () => {
    describe('Function components', () => {
      it('should detect function components', () => {
        const code = `
function MyComponent() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'function',
          isExported: false,
          isDefault: false
        })
      })

      it('should detect exported function components', () => {
        const code = `
export function MyComponent() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'function',
          isExported: true,
          isDefault: false
        })
      })

      it('should detect export default function components', () => {
        const code = `
export default function MyComponent() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'function',
          isExported: true,
          isDefault: true
        })
      })

      it('should ignore function names starting with lowercase', () => {
        const code = `
function myHelper() {
  return 'not a component'
}

function MyComponent() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })

      it('should detect function with multiple parameters', () => {
        const code = `
function MyComponent(props, context) {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })
    })

    describe('Arrow function components', () => {
      it('should detect arrow function components', () => {
        const code = `
const MyComponent = () => <div>Hello</div>
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'arrow',
          isExported: false,
          isDefault: false
        })
      })

      it('should detect arrow function with parameters', () => {
        const code = `
const MyComponent = (props) => <div>Hello</div>
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })

      it('should detect arrow function with destructured parameters', () => {
        const code = `
const MyComponent = ({ title, onClick }) => <div>{title}</div>
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })

      it('should detect arrow function with multiline body', () => {
        const code = `
const MyComponent = () => {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })
    })

    describe('Class components', () => {
      it('should detect class components', () => {
        const code = `
class MyComponent extends React.Component {
  render() {
    return <div>Hello</div>
  }
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'class',
          isExported: false,
          isDefault: false
        })
      })

      it('should detect exported class components', () => {
        const code = `
export default class MyComponent extends React.Component {
  render() {
    return <div>Hello</div>
  }
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'class',
          isExported: true,
          isDefault: true
        })
      })

      it('should detect export default class components', () => {
        const code = `
export default class MyComponent extends React.Component {
  render() {
    return <div>Hello</div>
  }
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'class',
          isExported: true,
          isDefault: true
        })
      })
    })

    describe('Const function components', () => {
      it('should detect const function components', () => {
        const code = `
const MyComponent = function() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          type: 'function'
        })
      })

      it('should detect const function with parameters', () => {
        const code = `
const MyComponent = function(props) {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })
    })

    describe('Multiple components', () => {
      it('should detect multiple components in one file', () => {
        const code = `
function ComponentOne() {
  return <div>One</div>
}

function ComponentTwo() {
  return <div>Two</div>
}

function ComponentThree() {
  return <div>Three</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(3)
        expect(components.map(c => c.name)).toEqual(['ComponentOne', 'ComponentTwo', 'ComponentThree'])
      })

      it('should handle mix of function and arrow components', () => {
        const code = `
function FunctionComponent() {
  return <div>Function</div>
}

const ArrowComponent = () => <div>Arrow</div>

const AnotherArrow = (props) => {
  return <div>Another</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(3)
        expect(components[0].type).toBe('function')
        expect(components[1].type).toBe('arrow')
        expect(components[2].type).toBe('arrow')
      })

      it('should handle mix of function and class components', () => {
        const code = `
function FunctionComponent() {
  return <div>Function</div>
}

class ClassComponent extends React.Component {
  render() {
    return <div>Class</div>
  }
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(2)
        expect(components[0].type).toBe('function')
        expect(components[1].type).toBe('class')
      })
    })

    describe('Export default handling', () => {
      it('should handle export default pointing to existing component', () => {
        const code = `
function MyComponent() {
  return <div>Hello</div>
}

export default MyComponent
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0]).toMatchObject({
          name: 'MyComponent',
          isExported: true,
          isDefault: true
        })
      })

      it('should handle export default with semicolon', () => {
        const code = `
const MyComponent = () => <div>Hello</div>

export default MyComponent;
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].isDefault).toBe(true)
      })

      it('should handle inline export default', () => {
        const code = `
const MyComponent = () => <div>Hello</div>
export default MyComponent
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].isDefault).toBe(true)
      })
    })

    describe('Named exports', () => {
      it('should detect named exports in curly braces', () => {
        const code = `
function ComponentOne() {
  return <div>One</div>
}

function ComponentTwo() {
  return <div>Two</div>
}

export { ComponentOne, ComponentTwo }
`
        const components = detectReactComponents(code)
        const one = components.find(c => c.name === 'ComponentOne')
        const two = components.find(c => c.name === 'ComponentTwo')
        expect(one?.isExported).toBe(true)
        expect(two?.isExported).toBe(true)
      })

      it('should handle named export with aliases', () => {
        const code = `
function MyComponent() {
  return <div>Hello</div>
}

export { MyComponent as MyAlias }
`
        const components = detectReactComponents(code)
        const component = components.find(c => c.name === 'MyComponent')
        expect(component?.isExported).toBe(true)
      })
    })

    describe('Non-component code', () => {
      it('should return empty array for code with no components', () => {
        const code = `
const x = 5
const y = 10
function helper() {
  return x + y
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(0)
      })

      it('should ignore lowercase function names', () => {
        const code = `
function renderComponent() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(0)
      })

      it('should return empty array for completely empty code', () => {
        const components = detectReactComponents('')
        expect(components).toHaveLength(0)
      })

      it('should ignore numbers in component detection', () => {
        const code = `
const x = 123
const y = 456
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(0)
      })
    })

    describe('Edge cases', () => {
      it('should handle component names with numbers', () => {
        const code = `
function Component123() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('Component123')
      })

      it('should handle component names with underscores', () => {
        const code = `
const My_Component = () => <div>Hello</div>
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('My_Component')
      })

      it('should not duplicate components', () => {
        const code = `
function MyComponent() {
  return <div>Hello</div>
}

export function MyComponent() {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
      })

      it('should handle whitespace variations', () => {
        const code = `
function  MyComponent  (  )  {
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })

      it('should handle comments in code', () => {
        const code = `
// This is a comment
function MyComponent() {
  // Another comment
  return <div>Hello</div>
}
`
        const components = detectReactComponents(code)
        expect(components).toHaveLength(1)
        expect(components[0].name).toBe('MyComponent')
      })
    })
  })

  describe('getMainReactComponent', () => {
    describe('Priority: Default export', () => {
      it('should prioritize default exported component', () => {
        const code = `
function ComponentOne() {
  return <div>One</div>
}

export default function ComponentTwo() {
  return <div>Two</div>
}
`
        const main = getMainReactComponent(code)
        expect(main).toBe('ComponentTwo')
      })

      it('should return default exported component when multiple exist', () => {
        const code = `
export default function MainComponent() {
  return <div>Main</div>
}

function HelperComponent() {
  return <div>Helper</div>
}

const AnotherComponent = () => <div>Another</div>
`
        const main = getMainReactComponent(code)
        expect(main).toBe('MainComponent')
      })
    })

    describe('Priority: Named export', () => {
      it('should fall back to named exported component', () => {
        const code = `
export function NamedComponent() {
  return <div>Named</div>
}

function UnexportedComponent() {
  return <div>Unexported</div>
}
`
        const main = getMainReactComponent(code)
        expect(main).toBe('NamedComponent')
      })

      it('should return any exported component when no default', () => {
        const code = `
function ComponentOne() {
  return <div>One</div>
}

export function ComponentTwo() {
  return <div>Two</div>
}

function ComponentThree() {
  return <div>Three</div>
}
`
        const main = getMainReactComponent(code)
        expect(main).toBe('ComponentTwo')
      })
    })

    describe('Priority: First component', () => {
      it('should fall back to first component when none exported', () => {
        const code = `
function FirstComponent() {
  return <div>First</div>
}

function SecondComponent() {
  return <div>Second</div>
}
`
        const main = getMainReactComponent(code)
        expect(main).toBe('FirstComponent')
      })

      it('should return first component in order of appearance', () => {
        const code = `
function ComponentA() { return <div>A</div> }
const ComponentB = () => <div>B</div>
class ComponentC extends React.Component { render() { return <div>C</div> } }
`
        const main = getMainReactComponent(code)
        expect(main).toBe('ComponentA')
      })
    })

    describe('No components', () => {
      it('should return null when no components exist', () => {
        const code = 'const x = 5'
        const main = getMainReactComponent(code)
        expect(main).toBeNull()
      })

      it('should return null for empty code', () => {
        const main = getMainReactComponent('')
        expect(main).toBeNull()
      })
    })

    describe('Real-world scenarios', () => {
      it('should handle typical React file structure', () => {
        const code = `
import React from 'react'

const HelperComponent = () => <div>Helper</div>

export default function App() {
  return <HelperComponent />
}
`
        const main = getMainReactComponent(code)
        expect(main).toBe('App')
      })

      it('should handle multiple exported components', () => {
        const code = `
export function Button() {
  return <button>Click</button>
}

export function Card() {
  return <div>Card</div>
}

export default Button
`
        const main = getMainReactComponent(code)
        expect(main).toBe('Button')
      })

      it('should prioritize correctly with all component types', () => {
        const code = `
function Simple() { return <div>Simple</div> }
const Arrow = () => <div>Arrow</div>
class Class extends React.Component { render() { return <div>Class</div> } }
export const Exported = () => <div>Exported</div>
export default function Default() { return <div>Default</div> }
`
        const main = getMainReactComponent(code)
        expect(main).toBe('Default')
      })

      it('should work with export default referencing named component', () => {
        const code = `
const MyComponent = () => <div>Hello</div>
export default MyComponent
`
        const main = getMainReactComponent(code)
        expect(main).toBe('MyComponent')
      })
    })
  })

  describe('Integration tests', () => {
    it('should work together for validation flow', () => {
      const code = `
import React from 'react'

function HeaderComponent() {
  return <header>Header</header>
}

export default function MainApp() {
  return (
    <div>
      <HeaderComponent />
      <main>Content</main>
    </div>
  )
}
`
      const components = detectReactComponents(code)
      const main = getMainReactComponent(code)

      expect(components).toHaveLength(2)
      expect(components.some(c => c.name === 'HeaderComponent')).toBe(true)
      expect(components.some(c => c.name === 'MainApp')).toBe(true)
      expect(main).toBe('MainApp')
      expect(components.find(c => c.name === 'MainApp')?.isDefault).toBe(true)
    })

    it('should handle complex real-world component', () => {
      const code = `
import React, { useState } from 'react'

function ControlButton({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>
}

export default function Counter() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <p>Count: {count}</p>
      <ControlButton label="Increment" onClick={() => setCount(count + 1)} />
    </div>
  )
}
`
      const components = detectReactComponents(code)
      const main = getMainReactComponent(code)

      expect(components).toHaveLength(2)
      expect(main).toBe('Counter')
    })
  })
})
