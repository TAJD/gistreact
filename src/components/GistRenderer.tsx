import { useState, useEffect, useRef } from 'react'
import { Sandpack } from '@codesandbox/sandpack-react'
import { getMainReactComponent } from '../utils/astComponentDetector'

interface GistResponse {
  content: string
  filename: string
  gistId: string
  shareId?: string
  isShared?: boolean
}

interface GistRendererProps {
  gistId: string
}

function ShareableLink({ shareId, gistId }: { shareId: string; gistId: string }) {
  const [customName, setCustomName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [currentShareId, setCurrentShareId] = useState(shareId)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  
  const shareUrl = `${window.location.origin}/share/${currentShareId}`
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
  }
  
  const updateCustomName = async () => {
    if (!customName.trim()) {
      setError('Custom name cannot be empty')
      return
    }
    
    if (customName.length < 3) {
      setError('Custom name must be at least 3 characters')
      return
    }
    
    if (!/^[a-zA-Z0-9-_]+$/.test(customName)) {
      setError('Custom name can only contain letters, numbers, hyphens, and underscores')
      return
    }
    
    setIsUpdating(true)
    setError('')
    
    try {
      const response = await fetch('/api/update-share-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gistId,
          oldShareId: currentShareId,
          newShareId: customName.trim()
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update custom name')
      }
      
      setCurrentShareId(customName.trim())
      setIsEditing(false)
      setCustomName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsUpdating(false)
    }
  }
  
  const cancelEdit = () => {
    setIsEditing(false)
    setCustomName('')
    setError('')
  }
  
  return (
    <div className="shareable-link">
      <div className="share-info">
        <span className="share-label">🔗 Shareable link:</span>
        <code className="share-url">{shareUrl}</code>
        <button 
          onClick={copyToClipboard}
          className="copy-btn"
          title="Copy to clipboard"
        >
          📋
        </button>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="edit-btn"
          title="Customize link"
        >
          ✏️
        </button>
      </div>
      
      {isEditing && (
        <div className="custom-name-editor">
          <div className="editor-row">
            <span className="url-prefix">{window.location.origin}/share/</span>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="my-custom-name"
              className="custom-name-input"
              disabled={isUpdating}
            />
            <button 
              onClick={updateCustomName}
              disabled={isUpdating || !customName.trim()}
              className="save-btn"
            >
              {isUpdating ? '...' : '✓'}
            </button>
            <button 
              onClick={cancelEdit}
              disabled={isUpdating}
              className="cancel-btn"
            >
              ✕
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="editor-help">
            Use letters, numbers, hyphens, and underscores only (min 3 characters)
          </div>
        </div>
      )}
    </div>
  )
}

export function GistRenderer({ gistId }: GistRendererProps) {
  const [component, setComponent] = useState<GistResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const loadComponent = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log(`🔍 Fetching gist: ${gistId}`)
        // Check if this is a share ID or direct gist ID
        const isShareId = window.location.pathname.startsWith('/share/')
        const fetchUrl = isShareId ? `/share/${gistId}` : `/${gistId}`
        const response = await fetch(fetchUrl, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        
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

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY.current
      const scrollThreshold = 10

      if (Math.abs(currentScrollY - lastScrollY.current) > scrollThreshold) {
        if (scrollingDown && currentScrollY > 100) {
          setIsHeaderVisible(false)
        } else if (!scrollingDown) {
          setIsHeaderVisible(true)
        }
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const goHome = () => {
    window.history.pushState(null, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  if (loading) {
    return (
      <div className="gist-renderer">
        <nav ref={headerRef} role="navigation" className={`gist-nav ${isHeaderVisible ? 'visible' : 'hidden'}`}>
          <button onClick={goHome} className="home-btn">← Home</button>
        </nav>
        <div className="loading">Loading component...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="gist-renderer">
        <nav ref={headerRef} role="navigation" className={`gist-nav ${isHeaderVisible ? 'visible' : 'hidden'}`}>
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
        <nav ref={headerRef} role="navigation" className={`gist-nav ${isHeaderVisible ? 'visible' : 'hidden'}`}>
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

  // Extract the component name using AST parsing first, fallback to regex
  let componentName = getMainReactComponent(component.content) || 'Component';
  
  // If AST parsing didn't find a component, try regex patterns as fallback
  if (componentName === 'Component') {
    const patterns = [
      /export default (\w+)/,                    // export default ComponentName
      /export default function (\w+)/,          // export default function ComponentName()
      /const (\w+) = .*export default \1/s,     // const ComponentName = ... export default ComponentName
      /function (\w+)\(.*\).*export default \1/s, // function ComponentName() ... export default ComponentName
      /const (\w+) = \(/,                       // const ComponentName = (
      /function (\w+)\(/                        // function ComponentName(
    ];
    
    for (const pattern of patterns) {
      const match = component.content.match(pattern);
      if (match && match[1]) {
        componentName = match[1];
        break;
      }
    }
  }
  
  console.log(`🔍 Component name detection:`, { componentName, filename: component.filename });
  
  // Check if the component has a default export, if not, add one
  let processedContent = component.content;
  
  if (!component.content.includes('export default')) {
    console.log(`⚠️  No default export found, adding one for component: ${componentName}`);
    processedContent = `${component.content}\n\nexport default ${componentName};`;
  }
  
  // Create files with proper import structure
  const files = {
    [`${componentName}.tsx`]: processedContent,
    'App.tsx': `import React from 'react';
import ${componentName} from './${componentName}';

export default function App() {
  return <${componentName} />;
}`
  }
  
  console.log(`📄 Processed content preview:`, processedContent.substring(0, 200) + '...');
  console.log(`🔍 Has default export:`, processedContent.includes('export default'));

  console.log(`🎯 Detected component: ${componentName}`)
  console.log(`📄 Content length:`, component.content?.length)
  console.log(`📂 Files:`, Object.keys(files))

  return (
    <div className="gist-renderer">
      <nav ref={headerRef} role="navigation" className={`gist-nav ${isHeaderVisible ? 'visible' : 'hidden'}`}>
        <button onClick={goHome} className="home-btn">← Home</button>
        <div className="gist-info">
          <span className="filename">{component.filename}</span>
          <span className="gist-id">Gist: {gistId}</span>
        </div>
      </nav>
      {component.shareId && <ShareableLink shareId={component.shareId} gistId={gistId} />}
      <div className="component-container">
        <Sandpack
          template="react-ts"
          files={files}
          customSetup={{
            dependencies: {
              // Core React dependencies
              'lucide-react': 'latest',
              '@swc/helpers': 'latest',
              
              // All Radix UI primitives (shadcn/ui components)
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
              
              // shadcn/ui utility libraries
              'class-variance-authority': 'latest',
              'clsx': 'latest',
              'tailwind-merge': 'latest',
              
              // Date handling
              'date-fns': 'latest',
              'react-day-picker': 'latest',
              
              // Form libraries
              'react-hook-form': 'latest',
              '@hookform/resolvers': 'latest',
              'zod': 'latest',
              
              // Additional UI libraries
              'input-otp': 'latest',
              'embla-carousel-react': 'latest',
              'react-resizable-panels': 'latest',
              'vaul': 'latest',
              'cmdk': 'latest',
              'sonner': 'latest',
              
              // Chart libraries
              'recharts': 'latest',
              
              // Utility libraries
              'lodash': 'latest',
              'nanoid': 'latest',
              
              // Animation
              'framer-motion': 'latest',
              
              // Theme
              'next-themes': 'latest'
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