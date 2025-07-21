import { useState, useEffect } from 'react'
import { Sandpack } from '@codesandbox/sandpack-react'

interface GistResponse {
  content: string
  filename: string
  gistId: string
}

interface GistRendererProps {
  gistId: string
}

export function GistRenderer({ gistId }: GistRendererProps) {
  const [component, setComponent] = useState<GistResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadComponent = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log(`🔍 Fetching gist: ${gistId}`)
        const response = await fetch(`/${gistId}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const data: GistResponse = await response.json()
        console.log(`✅ Gist data loaded:`, {
          filename: data.filename,
          gistId: data.gistId,
          contentLength: data.content?.length,
          contentPreview: data.content?.substring(0, 100)
        })
        setComponent(data)
      } catch (err) {
        console.error(`❌ Error loading gist ${gistId}:`, err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setLoading(false)
      }
    }

    loadComponent()
  }, [gistId])

  const goHome = () => {
    window.history.pushState(null, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  if (loading) {
    return (
      <div className="gist-renderer">
        <nav className="gist-nav">
          <button onClick={goHome} className="home-btn">← Home</button>
        </nav>
        <div className="loading">Loading component...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="gist-renderer">
        <nav className="gist-nav">
          <button onClick={goHome} className="home-btn">← Home</button>
        </nav>
        <div className="error">
          <h2>Error loading component</h2>
          <p>{error}</p>
          <details>
            <summary>Troubleshooting</summary>
            <ul>
              <li>Ensure the Gist exists and is public</li>
              <li>Make sure the Gist contains a .tsx file</li>
              <li>Check that the component exports a default React component</li>
              <li>Verify all imports use allowed libraries</li>
            </ul>
          </details>
        </div>
      </div>
    )
  }

  if (!component) {
    return (
      <div className="gist-renderer">
        <nav className="gist-nav">
          <button onClick={goHome} className="home-btn">← Home</button>
        </nav>
        <div className="component-container">
          {loading && <div className="loading">Loading component...</div>}
          {error && (
            <div className="error">
              <h2>Error loading component</h2>
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Extract the component name from the gist content
  const componentNameMatch = component.content.match(/export default (\w+)/);
  const componentName = componentNameMatch ? componentNameMatch[1] : 'Component';
  
  // Create files with proper import structure
  const files = {
    [`${componentName}.tsx`]: component.content,
    'App.tsx': `import React from 'react';
import ${componentName} from './${componentName}';

export default function App() {
  return <${componentName} />;
}`
  }

  console.log(`🎯 Detected component: ${componentName}`)
  console.log(`📄 Content length:`, component.content?.length)
  console.log(`📂 Files:`, Object.keys(files))

  return (
    <div className="gist-renderer">
      <nav className="gist-nav">
        <button onClick={goHome} className="home-btn">← Home</button>
        <div className="gist-info">
          <span className="filename">{component.filename}</span>
          <span className="gist-id">Gist: {gistId}</span>
        </div>
      </nav>
      <div className="component-container">
        <Sandpack
          template="react-ts"
          files={files}
          customSetup={{
            dependencies: {
              'lucide-react': 'latest',
              '@swc/helpers': 'latest',
              // Add common shadcn dependencies
              '@radix-ui/react-slot': 'latest',
              'class-variance-authority': 'latest',
              'clsx': 'latest',
              'tailwind-merge': 'latest',
              'date-fns': 'latest',
              'lodash': 'latest'
            }
          }}
          options={{
            layout: 'preview',
            showNavigator: false,
            showTabs: false,
            showLineNumbers: false,
            autorun: true,
            autoReload: true,
            externalResources: [
              'https://cdn.tailwindcss.com'
            ]
          }}
        />
      </div>
    </div>
  )
}