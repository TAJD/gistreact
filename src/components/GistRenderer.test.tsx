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

  it('hides header when scrolling down past threshold', async () => {
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

    // First simulate being at top (small scroll)
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 5,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    // Then simulate scrolling down past threshold
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 150, // Past the 100px threshold and 10px scroll diff
      })
      
      // Trigger scroll event
      const scrollEvent = new Event('scroll')
      window.dispatchEvent(scrollEvent)
    })

    await waitFor(() => {
      expect(nav).toHaveClass('hidden')
      expect(nav).not.toHaveClass('visible')
    })
  })

  it('shows header when scrolling up', async () => {
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

    // Start with small scroll
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 5,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    // First scroll down to hide header
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 150,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      expect(nav).toHaveClass('hidden')
    })

    // Then scroll up to show header
    await act(async () => {
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        value: 100,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      expect(nav).toHaveClass('visible')
      expect(nav).not.toHaveClass('hidden')
    })
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
    
    await waitFor(() => {
      expect(screen.getByText('🔗 Shareable link:')).toBeInTheDocument()
      expect(screen.getByText(/\/share\/my-share-id/)).toBeInTheDocument()
    })
  })
})