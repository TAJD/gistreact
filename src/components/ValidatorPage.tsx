import { useState, useCallback, useEffect } from 'react'
import { Sandpack } from '@codesandbox/sandpack-react'
import { validateComponent, type ValidationResult } from '../utils/componentValidator'

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
  if (status === 'pass') return <span className="check-icon pass">✓</span>
  if (status === 'fail') return <span className="check-icon fail">✕</span>
  return <span className="check-icon warn">⚠</span>
}

export function ValidatorPage() {
  const [code, setCode] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

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
    if (newCode.trim().length > 0) {
      setValidation(validateComponent(newCode))
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
          <textarea
            className="code-editor"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="Paste your React TSX component here..."
            spellCheck={false}
          />
        </section>

        {validation && (
          <section className="validation-section">
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
                  <div className="summary-pass">
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
                <div className="summary-fail">
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
                customSetup={{
                  dependencies: {
                    'lucide-react': 'latest',
                    '@swc/helpers': 'latest',
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
                    'class-variance-authority': 'latest',
                    'clsx': 'latest',
                    'tailwind-merge': 'latest',
                    'date-fns': 'latest',
                    'react-day-picker': 'latest',
                    'react-hook-form': 'latest',
                    '@hookform/resolvers': 'latest',
                    'zod': 'latest',
                    'input-otp': 'latest',
                    'embla-carousel-react': 'latest',
                    'react-resizable-panels': 'latest',
                    'vaul': 'latest',
                    'cmdk': 'latest',
                    'sonner': 'latest',
                    'recharts': 'latest',
                    'lodash': 'latest',
                    'nanoid': 'latest',
                    'framer-motion': 'latest',
                    'next-themes': 'latest',
                  },
                }}
                options={{
                  layout: 'preview',
                  showNavigator: false,
                  showTabs: false,
                  showLineNumbers: false,
                  autorun: true,
                  autoReload: true,
                  externalResources: ['https://cdn.tailwindcss.com'],
                }}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
