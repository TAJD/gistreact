import { useState, useEffect, useRef } from 'react'
import { Sandpack } from '@codesandbox/sandpack-react'
import { getMainReactComponent } from '../utils/astComponentDetector'
import { SANDPACK_DEPENDENCIES, SANDPACK_EXTERNAL_RESOURCES } from '../config/sandpackDependencies'

interface GistResponse {
  content: string
  filename: string
  description?: string | null
  gistId: string
  shareId?: string
  isShared?: boolean
  fromCache?: boolean
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
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/share/${currentShareId}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          aria-label="Copy share link"
        >
          {copied ? '✓' : '📋'}
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
  const [showCode, setShowCode] = useState(false)
  const [reported, setReported] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const lastScrollY = useRef(0)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const loadComponent = async () => {
      try {
        setLoading(true)
        setError(null)
        
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
        setComponent(data)
      } catch (err) {
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
  
  
  // Check if the component has a default export, if not, add one
  let processedContent = component.content;
  
  if (!component.content.includes('export default')) {
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
  

  const isShareRoute = window.location.pathname.startsWith('/share/')
  const githubGistUrl = !isShareRoute && gistId.length >= 32
    ? `https://gist.github.com/${gistId}`
    : null

  const handleRefresh = () => {
    setLoading(true)
    setError(null)
    setComponent(null)
    window.location.reload()
  }

  const handleDownload = () => {
    if (!component) return
    const blob = new Blob([component.content], { type: 'text/typescript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = component.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const embedCode = `<iframe src="${window.location.origin}/share/${component?.shareId || gistId}" width="100%" height="500" frameborder="0"></iframe>`

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (component?.shareId) {
          navigator.clipboard.writeText(`${window.location.origin}/share/${component.shareId}`)
        }
      }
      if (e.key === 'Escape') {
        setShowEmbed(false)
        setShowCode(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [component?.shareId])

  return (
    <div className="gist-renderer">
      <nav ref={headerRef} role="navigation" className={`gist-nav ${isHeaderVisible ? 'visible' : 'hidden'}`}>
        <button onClick={goHome} className="home-btn">← Home</button>
        <div className="gist-info">
          <span className="filename">{component.filename}</span>
          {githubGistUrl && (
            <a href={githubGistUrl} target="_blank" rel="noopener noreferrer" className="github-link" aria-label="View on GitHub">
              GitHub ↗
            </a>
          )}
          <button onClick={handleRefresh} className="refresh-btn" aria-label="Refresh component" title="Re-fetch from GitHub">
            ↻
          </button>
          <button
            onClick={() => setShowCode(!showCode)}
            className={`code-toggle-btn ${showCode ? 'active' : ''}`}
            aria-label={showCode ? 'Hide code' : 'Show code'}
            title={showCode ? 'Hide code' : 'Show code'}
          >
            {showCode ? '⟨/⟩' : '⟨⟩'}
          </button>
          <button onClick={handleDownload} className="refresh-btn" aria-label="Download component" title="Download .tsx file">
            ↓
          </button>
          <button
            onClick={() => setShowEmbed(!showEmbed)}
            className={`refresh-btn ${showEmbed ? 'active' : ''}`}
            aria-label="Embed code"
            title="Get embed code"
          >
            &lt;/&gt;
          </button>
          <button
            onClick={async () => {
              if (reported) return
              const reason = prompt('Why are you reporting this component?')
              if (!reason || reason.length < 3) return
              try {
                await fetch('/api/report', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gistId, shareId: component?.shareId, reason }),
                })
                setReported(true)
              } catch { /* silent */ }
            }}
            className="report-btn"
            aria-label="Report abuse"
            title={reported ? 'Reported' : 'Report this component'}
            disabled={reported}
          >
            {reported ? '✓ Reported' : '⚑'}
          </button>
        </div>
      </nav>
      {showEmbed && (
        <div className="embed-popover">
          <div className="embed-content">
            <span className="embed-label">Embed this component:</span>
            <code className="embed-code">{embedCode}</code>
            <button
              className="copy-btn"
              onClick={() => navigator.clipboard.writeText(embedCode)}
              aria-label="Copy embed code"
            >
              📋 Copy
            </button>
          </div>
        </div>
      )}
      {component.description && (
        <div className="component-description">
          {component.description}
        </div>
      )}
      {component.fromCache && (
        <div className="cache-notice">
          💾 Showing cached version (GitHub temporarily unavailable)
        </div>
      )}
      {component.shareId && <ShareableLink shareId={component.shareId} gistId={gistId} />}
      <div className={`component-container ${component.shareId ? 'with-share-link' : ''} ${showCode ? 'show-code' : ''}`}>
        <Sandpack
          template="react-ts"
          files={files}
          customSetup={{ dependencies: SANDPACK_DEPENDENCIES }}
          options={{
            showNavigator: false,
            showTabs: showCode,
            showLineNumbers: showCode,
            autorun: true,
            autoReload: true,
            externalResources: SANDPACK_EXTERNAL_RESOURCES,
          }}
        />
      </div>
    </div>
  )
}