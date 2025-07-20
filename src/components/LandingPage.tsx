import { useState, useEffect } from 'react'

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
            <li>Visit <code>yoursite.com/&lt;gist-id&gt;</code></li>
            <li>Your component is live!</li>
          </ol>
        </section>

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
        <p>Built with React, TypeScript, and Cloudflare Workers</p>
      </footer>
    </div>
  )
}