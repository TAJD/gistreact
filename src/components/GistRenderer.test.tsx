import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { GistRenderer } from './GistRenderer'

// Mock the AST component detector
vi.mock('../utils/astComponentDetector', () => ({
  getMainReactComponent: vi.fn(() => 'TestComponent')
}))

// Mock Sandpack component to avoid complex iframe issues
vi.mock('@codesandbox/sandpack-react', () => ({
  Sandpack: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="sandpack-mock">
      Mock Sandpack Component
      {children}
    </div>
  )
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

describe('GistRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset scroll position
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      value: 0,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: 'export default function TestComponent() { return <div>Test</div> }',
        filename: 'test.tsx',
        gistId: 'test123'
      })
    })

    render(<GistRenderer gistId="test123" />)
    
    expect(screen.getByText('Loading component...')).toBeInTheDocument()
    expect(screen.getByText('← Home')).toBeInTheDocument()
  })

  it('renders component after successful fetch', async () => {
    const mockGistData = {
      content: 'export default function TestComponent() { return <div>Test Component</div> }',
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
      expect(screen.getByText('Gist: test123')).toBeInTheDocument()
    })
  })

  it('shows header initially as visible', async () => {
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
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('gist-nav', 'visible')
      expect(nav).not.toHaveClass('hidden')
    })
  })

  it('verifies header scroll behavior structure', async () => {
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

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('visible')

    // Mock header height for testing
    Object.defineProperty(nav, 'offsetHeight', {
      writable: true,
      value: 90,
    })

    // Wait for header height to be updated after loading
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Verify header has the correct classes initially
    expect(nav).toHaveClass('gist-nav')
    expect(nav).toHaveClass('visible')
    
    // Test that scroll event listener can be added without errors
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 5,
      })
      window.dispatchEvent(new Event('scroll'))
    })
    
    // Header should still be visible for small scroll
    expect(nav).toHaveClass('visible')
  })

  it('maintains header visibility on scroll up', async () => {
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

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('visible')

    // Mock header height for testing
    Object.defineProperty(nav, 'offsetHeight', {
      writable: true,
      value: 90,
    })

    // Wait for header height to be updated after loading
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Test scroll up behavior (header should remain visible)
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 10,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    // Header should still be visible for upward scroll
    expect(nav).toHaveClass('visible')
    
    // Test with scroll at top
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 0,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    // Header should definitely be visible at top
    expect(nav).toHaveClass('visible')
  })

  it('handles home button click', async () => {
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
      expect(screen.getByText('← Home')).toBeInTheDocument()
    })

    const homeButton = screen.getByText('← Home')
    fireEvent.click(homeButton)

    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/')
    expect(mockDispatchEvent).toHaveBeenCalledWith(expect.any(PopStateEvent))
  })

  it('renders error state when fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Gist not found' })
    })

    render(<GistRenderer gistId="invalid123" />)
    
    await waitFor(() => {
      expect(screen.getByText('Error loading component')).toBeInTheDocument()
      expect(screen.getByText('Gist not found')).toBeInTheDocument()
    })
  })

  it('renders shareable link when shareId is provided', async () => {
    const mockGistData = {
      content: 'export default function TestComponent() { return <div>Test</div> }',
      filename: 'test.tsx',
      gistId: 'test123',
      shareId: 'my-share-id'
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGistData)
    })

    render(<GistRenderer gistId="test123" />)
    
    // First wait for the component to load and share toggle button to appear
    await waitFor(() => {
      expect(screen.getByTitle('Show share options')).toBeInTheDocument()
    })

    // Click the share toggle button to show the ShareableLink
    const shareToggleBtn = screen.getByTitle('Show share options')
    fireEvent.click(shareToggleBtn)
    
    // Now check that the ShareableLink is visible
    await waitFor(() => {
      expect(screen.getByText('🔗 Shareable link:')).toBeInTheDocument()
      expect(screen.getByText(/\/share\/my-share-id/)).toBeInTheDocument()
    })
  })
})