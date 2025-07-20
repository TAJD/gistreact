import { useState, useEffect } from 'react'
import { GistRenderer } from './components/GistRenderer'
import { LandingPage } from './components/LandingPage'
import './App.css'

function App() {
  const [gistId, setGistId] = useState<string | null>(null)

  useEffect(() => {
    const path = window.location.pathname
    const id = path.slice(1) // Remove leading slash
    
    if (id && id.length > 0 && !id.includes('/')) {
      setGistId(id)
    } else {
      setGistId(null)
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      const id = path.slice(1)
      
      if (id && id.length > 0 && !id.includes('/')) {
        setGistId(id)
      } else {
        setGistId(null)
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
