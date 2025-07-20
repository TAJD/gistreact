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
import './styles.css';

const container = document.getElementById('root')!;
const root = ReactDOM.createRoot(container);
root.render(<App />);`
    },
    '/styles.css': {
      code: `/* Tailwind CSS via CDN - loaded externally */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  width: 100%;
  height: 100vh;
}`
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
              '@types/react-dom': '^18.2.0',
              'lucide-react': '^0.525.0',
              // Radix UI primitives (core shadcn dependencies)
              '@radix-ui/react-accordion': '^1.2.11',
              '@radix-ui/react-alert-dialog': '^1.1.14',
              '@radix-ui/react-avatar': '^1.1.10',
              '@radix-ui/react-checkbox': '^1.3.2',
              '@radix-ui/react-collapsible': '^1.1.11',
              '@radix-ui/react-dialog': '^1.1.14',
              '@radix-ui/react-dropdown-menu': '^2.1.15',
              '@radix-ui/react-hover-card': '^1.1.14',
              '@radix-ui/react-label': '^2.1.7',
              '@radix-ui/react-menubar': '^1.1.15',
              '@radix-ui/react-navigation-menu': '^1.2.13',
              '@radix-ui/react-popover': '^1.1.14',
              '@radix-ui/react-progress': '^1.1.7',
              '@radix-ui/react-radio-group': '^1.3.7',
              '@radix-ui/react-scroll-area': '^1.2.9',
              '@radix-ui/react-select': '^2.2.5',
              '@radix-ui/react-separator': '^1.1.7',
              '@radix-ui/react-slider': '^1.3.5',
              '@radix-ui/react-slot': '^1.2.3',
              '@radix-ui/react-switch': '^1.2.5',
              '@radix-ui/react-tabs': '^1.1.12',
              '@radix-ui/react-toast': '^1.2.14',
              '@radix-ui/react-toggle': '^1.1.9',
              '@radix-ui/react-toggle-group': '^1.1.10',
              '@radix-ui/react-tooltip': '^1.2.7',
              // Utility libraries commonly used with shadcn
              'class-variance-authority': '^0.7.1',
              'clsx': '^2.1.1',
              'tailwind-merge': '^3.3.1',
              'date-fns': '^4.1.0',
              'react-day-picker': '^9.8.0',
              'input-otp': '^1.4.2',
              'embla-carousel-react': '^8.6.0',
              'react-resizable-panels': '^3.0.3',
              'vaul': '^1.1.2',
              'cmdk': '^1.1.1',
              'next-themes': '^0.4.6',
              'recharts': '^3.1.0',
              // Additional common libraries
              'lodash': '^4.17.21',
              '@types/lodash': '^4.17.20'
            }
          }}
          options={{
            showNavigator: false,
            showTabs: false,
            showLineNumbers: false,
            editorHeight: 100,
            editorWidthPercentage: 1,
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