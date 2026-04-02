import { Sandpack } from '@codesandbox/sandpack-react'
import { SANDPACK_DEPENDENCIES, SANDPACK_EXTERNAL_RESOURCES } from '../config/sandpackDependencies'

const DEMO_CODE = `export default function Greeting() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-violet-500 to-fuchsia-500">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Hello from ReactDrop</h1>
        <p className="text-gray-500">This component is running live in a sandbox</p>
      </div>
    </div>
  )
}`

export function LiveDemo() {
  return (
    <div className="live-demo">
      <Sandpack
        template="react-ts"
        files={{
          'Greeting.tsx': DEMO_CODE,
          'App.tsx': `import Greeting from './Greeting';\nexport default function App() { return <Greeting /> }`,
        }}
        customSetup={{ dependencies: SANDPACK_DEPENDENCIES }}
        options={{
          layout: 'preview',
          showNavigator: false,
          showTabs: false,
          showLineNumbers: false,
          autorun: true,
          externalResources: SANDPACK_EXTERNAL_RESOURCES,
        }}
      />
    </div>
  )
}
