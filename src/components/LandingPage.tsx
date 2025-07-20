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
          <img src="/logo.svg" alt="GistReact" className="logo" />
          <h1>GistReact</h1>
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
          <ol>
            <li>Create a GitHub Gist with a <code>.tsx</code> file</li>
            <li>Copy the Gist ID from the URL</li>
            <li>Visit <code>gistreact.verdient.co.uk/&lt;gist-id&gt;</code></li>
            <li>Your component is live!</li>
          </ol>
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