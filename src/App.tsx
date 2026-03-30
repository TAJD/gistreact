import { useState, useEffect } from 'react'
import { GistRenderer } from './components/GistRenderer'
import { LandingPage } from './components/LandingPage'
import { ValidatorPage } from './components/ValidatorPage'
import './App.css'

type Route = { type: 'landing' } | { type: 'validate' } | { type: 'gist'; id: string }

function resolveRoute(path: string): Route {
  if (path === '/validate') {
    return { type: 'validate' }
  }
  if (path.startsWith('/share/')) {
    const shareId = path.slice(7)
    if (shareId && shareId.length > 0) {
      return { type: 'gist', id: shareId }
    }
  } else {
    const id = path.slice(1)
    if (id && id.length > 0 && !id.includes('/')) {
      return { type: 'gist', id }
    }
  }
  return { type: 'landing' }
}

function App() {
  const [route, setRoute] = useState<Route>(() => resolveRoute(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => {
      setRoute(resolveRoute(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (route.type === 'validate') {
    return <ValidatorPage />
  }

  if (route.type === 'gist') {
    return <GistRenderer gistId={route.id} />
  }

  return <LandingPage />
}

export default App
