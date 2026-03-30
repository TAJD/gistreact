import { useState, useEffect } from 'react'

function GistUrlInput() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const extractGistId = (gistUrl: string): string | null => {
    try {
      const patterns = [
        /gist\.github\.com\/[^\/]+\/([a-f0-9]+)/,
        /gist\.github\.com\/([a-f0-9]+)/,
      ]
      
      for (const pattern of patterns) {
        const match = gistUrl.match(pattern)
        if (match) return match[1]
      }
      
      // If it's already just a gist ID
      if (/^[a-f0-9]+$/.test(gistUrl.trim())) {
        return gistUrl.trim()
      }
      
      return null
    } catch {
      return null
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!url.trim()) {
      setError('Please enter a GitHub Gist URL')
      return
    }

    const gistId = extractGistId(url)
    if (!gistId) {
      setError('Invalid GitHub Gist URL. Please enter a valid gist.github.com URL or gist ID.')
      return
    }

    // Navigate to the gist component
    window.history.pushState(null, '', `/${gistId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="gist-url-input">
      <h3>Try a Component</h3>
      <p>Paste a GitHub Gist URL or ID to view the React component instantly</p>
      <form onSubmit={handleSubmit} className="url-form">
        <div className="input-group">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://gist.github.com/username/gist-id or just the gist ID"
            className="url-input"
          />
          <button type="submit" className="url-submit">
            View Component
          </button>
        </div>
        {error && <div className="url-error">{error}</div>}
      </form>
    </div>
  )
}

interface GistEntry {
  gist_id: string
  filename: string
  view_count: number
  first_accessed_at: string
}

export function LandingPage() {
  const [recentGists, setRecentGists] = useState<GistEntry[]>([])
  const [popularGists, setPopularGists] = useState<GistEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGists = async () => {
      try {
        const [recentResponse, popularResponse] = await Promise.all([
          fetch('/api/recent'),
          fetch('/api/popular')
        ])

        if (recentResponse.ok) {
          const recent = await recentResponse.json()
          setRecentGists(recent)
        }

        if (popularResponse.ok) {
          const popular = await popularResponse.json()
          setPopularGists(popular)
        }
      } catch (error) {
        console.error('Error loading gists:', error)
      } finally {
        setLoading(false)
      }
    }

    loadGists()
  }, [])

  const handleGistClick = (gistId: string) => {
    window.history.pushState(null, '', `/${gistId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="landing-page">
      <header className="hero">
        <div className="hero-header">
          <img src="/logo.svg" alt="ReactDrop" className="logo" />
          <h1>ReactDrop</h1>
        </div>
        <p className="hero-description">
          Host and share React components directly from GitHub Gists
        </p>
        <div className="hero-features">
          <div className="feature">
            <h3>🚀 Instant Hosting</h3>
            <p>Share your React components with a simple URL</p>
          </div>
          <div className="feature">
            <h3>🔗 No CORS Issues</h3>
            <p>External resources load seamlessly through our proxy</p>
          </div>
          <div className="feature">
            <h3>📊 Analytics</h3>
            <p>Track views and popularity of your components</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="how-it-works">
          <h2>How it works</h2>
          <div className="workflow-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>🤖 Develop with Claude</h3>
                <p>Go to <a href="https://claude.ai/code" target="_blank" rel="noopener noreferrer">Claude Code</a>, create a React artifact, and iterate on your component design</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>📝 Create GitHub Gist</h3>
                <p>Copy your component code and create a <a href="https://gist.github.com" target="_blank" rel="noopener noreferrer">GitHub Gist</a> with a <code>.tsx</code> file</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>🔗 Get Gist URL</h3>
                <p>Copy the Gist ID from your GitHub Gist URL (e.g., <code>abc123def456</code>)</p>
              </div>
            </div>
            
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>🚀 Host Long-term</h3>
                <p>Paste the Gist URL below or visit <code>reactdrop.verdient.co.uk/&lt;gist-id&gt;</code> to host your component permanently</p>
              </div>
            </div>
          </div>
          
          <div className="workflow-benefits">
            <h3>🎯 Perfect for:</h3>
            <p>Rapid prototyping, component showcases, portfolio pieces, and client demos</p>
          </div>

          <div className="validate-cta">
            <p>Not sure if your component will work?</p>
            <button
              onClick={() => {
                window.history.pushState(null, '', '/validate')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
              className="validate-btn"
            >
              🔍 Validate Your Component
            </button>
          </div>
        </section>

        <section className="dependencies-section">
          <details className="dependencies-details">
            <summary>
              <h2>📦 Available Dependencies</h2>
              <p>Click to see all the libraries your components can use</p>
            </summary>
            
            <div className="dependencies-content">
              <div className="dependency-category">
                <h3>🎨 UI Components (shadcn/ui)</h3>
                <div className="dependency-grid">
                  <code>@radix-ui/react-accordion</code>
                  <code>@radix-ui/react-alert-dialog</code>
                  <code>@radix-ui/react-aspect-ratio</code>
                  <code>@radix-ui/react-avatar</code>
                  <code>@radix-ui/react-checkbox</code>
                  <code>@radix-ui/react-collapsible</code>
                  <code>@radix-ui/react-context-menu</code>
                  <code>@radix-ui/react-dialog</code>
                  <code>@radix-ui/react-dropdown-menu</code>
                  <code>@radix-ui/react-hover-card</code>
                  <code>@radix-ui/react-label</code>
                  <code>@radix-ui/react-menubar</code>
                  <code>@radix-ui/react-navigation-menu</code>
                  <code>@radix-ui/react-popover</code>
                  <code>@radix-ui/react-progress</code>
                  <code>@radix-ui/react-radio-group</code>
                  <code>@radix-ui/react-scroll-area</code>
                  <code>@radix-ui/react-select</code>
                  <code>@radix-ui/react-separator</code>
                  <code>@radix-ui/react-slider</code>
                  <code>@radix-ui/react-slot</code>
                  <code>@radix-ui/react-switch</code>
                  <code>@radix-ui/react-tabs</code>
                  <code>@radix-ui/react-toast</code>
                  <code>@radix-ui/react-toggle</code>
                  <code>@radix-ui/react-toggle-group</code>
                  <code>@radix-ui/react-tooltip</code>
                </div>
              </div>

              <div className="dependency-category">
                <h3>🔧 Utilities</h3>
                <div className="dependency-grid">
                  <code>class-variance-authority</code>
                  <code>clsx</code>
                  <code>tailwind-merge</code>
                  <code>lodash</code>
                  <code>nanoid</code>
                </div>
              </div>

              <div className="dependency-category">
                <h3>📅 Date & Forms</h3>
                <div className="dependency-grid">
                  <code>date-fns</code>
                  <code>react-day-picker</code>
                  <code>react-hook-form</code>
                  <code>@hookform/resolvers</code>
                  <code>zod</code>
                </div>
              </div>

              <div className="dependency-category">
                <h3>✨ Enhanced UI</h3>
                <div className="dependency-grid">
                  <code>lucide-react</code>
                  <code>input-otp</code>
                  <code>embla-carousel-react</code>
                  <code>react-resizable-panels</code>
                  <code>vaul</code>
                  <code>cmdk</code>
                  <code>sonner</code>
                  <code>framer-motion</code>
                  <code>next-themes</code>
                </div>
              </div>

              <div className="dependency-category">
                <h3>📊 Charts</h3>
                <div className="dependency-grid">
                  <code>recharts</code>
                </div>
              </div>

              <div className="features-note">
                <p><strong>✅ All dependencies automatically available</strong> - No need to install or configure anything!</p>
                <p><strong>🎨 Full Tailwind CSS support</strong> - All utility classes work out of the box</p>
                <p><strong>🔄 Real-time rendering</strong> - Components update instantly as you modify your gists</p>
              </div>
            </div>
          </details>
        </section>

        <GistUrlInput />

        {loading ? (
          <div className="loading">Loading gists...</div>
        ) : (
          <div className="gist-sections">
            <section className="gist-list">
              <h2>Recent Components</h2>
              {recentGists.length > 0 ? (
                <div className="gist-grid">
                  {recentGists.map((gist) => (
                    <div 
                      key={`${gist.gist_id}-${gist.filename}`}
                      className="gist-card"
                      onClick={() => handleGistClick(gist.gist_id)}
                    >
                      <h3>{gist.filename}</h3>
                      <p>Gist ID: {gist.gist_id}</p>
                      <p>Views: {gist.view_count}</p>
                      <p>Added: {new Date(gist.first_accessed_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No components have been hosted yet</p>
              )}
            </section>

            <section className="gist-list">
              <h2>Popular Components</h2>
              {popularGists.length > 0 ? (
                <div className="gist-grid">
                  {popularGists.map((gist) => (
                    <div 
                      key={`${gist.gist_id}-${gist.filename}`}
                      className="gist-card"
                      onClick={() => handleGistClick(gist.gist_id)}
                    >
                      <h3>{gist.filename}</h3>
                      <p>Gist ID: {gist.gist_id}</p>
                      <p>Views: {gist.view_count}</p>
                      <p>Added: {new Date(gist.first_accessed_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No components have been hosted yet</p>
              )}
            </section>
          </div>
        )}
      </main>

      <footer>
        <div className="footer-content">
          <p>Built with React, TypeScript, and Cloudflare Workers</p>
          <div className="feedback-section">
            <p>
              Have feedback or questions? Email us at{' '}
              <a href="mailto:tom@verdient.co.uk" className="email-link">
                tom@verdient.co.uk
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}