import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GistRenderer } from './GistRenderer'

// Mock the AST component detector
vi.mock('../utils/astComponentDetector', () => ({
  getMainReactComponent: vi.fn(() => 'TestComponent')
}))

// Mock Sandpack component to avoid complex iframe issues
vi.mock('@codesandbox/sandpack-react', () => ({
  Sandpack: () => <div data-testid="sandpack-mock">Mock Sandpack Component</div>
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.history
Object.defineProperty(window, 'history', {
  writable: true,
  value: {
    pushState: vi.fn(),
  },
})

// Mock window.dispatchEvent
const mockDispatchEvent = vi.fn()
window.dispatchEvent = mockDispatchEvent

describe('GistRenderer Simple', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      value: 0,
    })
  })

  it('renders with correct initial classes', async () => {
    const mockGistData = {
      content: 'export default function TestComponent() { return <div>Test</div> }',
      filename: 'test.tsx',
      gistId: 'test123'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGistData)
    })

    render(<GistRenderer gistId="test123" />)
    
    await waitFor(() => {
      expect(screen.getByText('test.tsx')).toBeInTheDocument()
    })

    // Get the nav that has the gist info (not loading state)
    const navWithGistInfo = screen.getByText('test.tsx').closest('nav')
    console.log('Nav className:', navWithGistInfo?.className)
    console.log('Nav classList:', navWithGistInfo?.classList.toString())
    
    // Check what classes are actually present
    expect(navWithGistInfo).toHaveClass('gist-nav')
    expect(navWithGistInfo).toHaveClass('visible')
  })
})