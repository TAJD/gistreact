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
        
        const response = await fetch(`/${gistId}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const data: GistResponse = await response.json()
        setComponent(data)
      } catch (err) {
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

  // Create files object for Sandpack
  const files = {
    '/App.tsx': {
      code: component.content
    },
    '/index.tsx': {
      code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const container = document.getElementById('root')!;
const root = ReactDOM.createRoot(container);
root.render(<App />);`
    }
  }

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
              'react': '^18.2.0',
              'react-dom': '^18.2.0',
              '@types/react': '^18.2.0',
              '@types/react-dom': '^18.2.0'
            }
          }}
          options={{
            showNavigator: false,
            showTabs: false,
            showLineNumbers: false,
            editorHeight: 100,
            editorWidthPercentage: 1,
            autorun: true,
            autoReload: true
          }}
        />
      </div>
    </div>
  )
}