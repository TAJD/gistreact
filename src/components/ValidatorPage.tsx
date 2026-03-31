import { useState, useCallback, useEffect, useRef } from 'react'
import { Sandpack } from '@codesandbox/sandpack-react'
import { validateComponent, type ValidationResult } from '../utils/componentValidator'
import { SANDPACK_DEPENDENCIES, SANDPACK_EXTERNAL_RESOURCES } from '../config/sandpackDependencies'

interface GitHubUser {
  login: string
  avatar_url: string
  id: number
}

const EXAMPLE_CODE = `import React, { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Counter</h1>
        <p className="text-6xl font-mono text-indigo-600 mb-6">{count}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setCount(c => c - 1)}
            className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
          >
            -
          </button>
          <button
            onClick={() => setCount(0)}
            className="px-6 py-3 bg-gray-500 text-white rounded-xl font-semibold hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setCount(c => c + 1)}
            className="px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
`

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'warn' }) {
  if (status === 'pass') return <span className="check-icon pass" aria-label="Passed">✓</span>
  if (status === 'fail') return <span className="check-icon fail" aria-label="Failed">✕</span>
  return <span className="check-icon warn" aria-label="Warning">⚠</span>
}

export function ValidatorPage() {
  const [code, setCode] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then((data: { authenticated: boolean; user?: GitHubUser }) => {
        if (data.authenticated && data.user) {
          setUser(data.user)
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
    setShowPreview(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (newCode.trim().length > 0) {
      debounceRef.current = setTimeout(() => {
        setValidation(validateComponent(newCode))
      }, 300)
    } else {
      setValidation(null)
    }
  }, [])

  const handleLoadExample = () => {
    handleCodeChange(EXAMPLE_CODE)
  }

  const goHome = () => {
    window.history.pushState(null, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const sandpackFiles = validation?.processedCode && validation.componentName
    ? {
        [`${validation.componentName}.tsx`]: validation.processedCode,
        'App.tsx': `import React from 'react';
import ${validation.componentName} from './${validation.componentName}';

export default function App() {
  return <${validation.componentName} />;
}`
      }
    : null

  return (
    <div className="validator-page">
      <nav className="validator-nav">
        <div className="nav-left">
          <button onClick={goHome} className="home-btn">← Home</button>
          <h1 className="validator-title">Component Validator</h1>
        </div>
        <div className="nav-right">
          {authLoading ? null : user ? (
            <div className="auth-user">
              <img src={user.avatar_url} alt={user.login} className="auth-avatar" />
              <span className="auth-username">{user.login}</span>
              <a href="/api/auth/logout" className="auth-logout">Sign out</a>
            </div>
          ) : (
            <a href="/api/auth/login" className="auth-login-btn">
              Sign in with GitHub
            </a>
          )}
        </div>
      </nav>

      <main className="validator-content">
        <section className="editor-section">
          <div className="editor-header">
            <h2>Paste your React component</h2>
            <button onClick={handleLoadExample} className="example-btn">
              Load example
            </button>
          </div>
          <label htmlFor="code-editor" className="sr-only">React component code</label>
          <textarea
            id="code-editor"
            className="code-editor"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="Paste your React TSX component here..."
            spellCheck={false}
            aria-describedby="validation-results"
          />
        </section>

        {validation && (
          <section className="validation-section" id="validation-results" aria-live="polite">
            <h2>Validation Results</h2>
            <div className="checks-list">
              {validation.checks.map((check) => (
                <div key={check.id} className={`check-item ${check.status}`}>
                  <StatusIcon status={check.status} />
                  <div className="check-content">
                    <span className="check-label">{check.label}</span>
                    <span className="check-message">{check.message}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="validation-summary">
              {validation.isDeployable ? (
                <>
                  <div className="summary-pass" role="status">
                    ✓ Component is deployable on ReactDrop
                  </div>
                  {!showPreview && (
                    <button
                      className="preview-btn"
                      onClick={() => setShowPreview(true)}
                    >
                      Preview Component
                    </button>
                  )}
                </>
              ) : (
                <div className="summary-fail" role="alert">
                  ✕ Fix the issues above before deploying
                </div>
              )}
            </div>
          </section>
        )}

        {showPreview && sandpackFiles && (
          <section className="preview-section">
            <h2>Live Preview</h2>
            <div className="preview-container">
              <Sandpack
                template="react-ts"
                files={sandpackFiles}
                customSetup={{ dependencies: SANDPACK_DEPENDENCIES }}
                options={{
                  layout: 'preview',
                  showNavigator: false,
                  showTabs: false,
                  showLineNumbers: false,
                  autorun: true,
                  autoReload: true,
                  externalResources: SANDPACK_EXTERNAL_RESOURCES,
                }}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
