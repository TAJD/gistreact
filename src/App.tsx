import { useState, useEffect } from 'react'
import { GistRenderer } from './components/GistRenderer'
import { LandingPage } from './components/LandingPage'
import './App.css'

function App() {
  const [gistId, setGistId] = useState<string | null>(null)

  useEffect(() => {
    const path = window.location.pathname
    
    if (path.startsWith('/share/')) {
      // Handle shareable links like /share/my-component
      const shareId = path.slice(7) // Remove '/share/' prefix
      if (shareId && shareId.length > 0) {
        setGistId(shareId)
      } else {
        setGistId(null)
      }
    } else {
      // Handle direct gist IDs like /e41c69596e5817832dca9c1c9e217391
      const id = path.slice(1) // Remove leading slash
      if (id && id.length > 0 && !id.includes('/')) {
        setGistId(id)
      } else {
        setGistId(null)
      }
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      
      if (path.startsWith('/share/')) {
        // Handle shareable links like /share/my-component
        const shareId = path.slice(7) // Remove '/share/' prefix
        if (shareId && shareId.length > 0) {
          setGistId(shareId)
        } else {
          setGistId(null)
        }
      } else {
        // Handle direct gist IDs like /e41c69596e5817832dca9c1c9e217391
        const id = path.slice(1) // Remove leading slash
        if (id && id.length > 0 && !id.includes('/')) {
          setGistId(id)
        } else {
          setGistId(null)
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (gistId) {
    return <GistRenderer gistId={gistId} />
  }

  return <LandingPage />
}

export default App
