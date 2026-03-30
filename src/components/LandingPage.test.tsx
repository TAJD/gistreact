import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LandingPage } from './LandingPage'

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

// Mock dispatchEvent
const mockDispatchEvent = vi.fn()
window.dispatchEvent = mockDispatchEvent

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the landing page with main elements', () => {
    render(<LandingPage />)
    
    expect(screen.getByText('ReactDrop')).toBeInTheDocument()
    expect(screen.getByText(/Transform GitHub Gists into live React components/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Enter GitHub Gist URL/)).toBeInTheDocument()
  })

  it('displays recent and popular sections', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    })

    render(<LandingPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Recent Components')).toBeInTheDocument()
      expect(screen.getByText('Popular Components')).toBeInTheDocument()
    })
  })

  it('handles gist URL submission', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    })

    render(<LandingPage />)
    
    const input = screen.getByPlaceholderText(/Enter GitHub Gist URL/)
    const submitButton = screen.getByText('Load Component')
    
    // Enter a valid gist URL
    fireEvent.change(input, { target: { value: 'https://gist.github.com/user/abc123' } })
    fireEvent.click(submitButton)
    
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/abc123')
    expect(mockDispatchEvent).toHaveBeenCalledWith(expect.any(PopStateEvent))
  })

  it('shows error for invalid URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    })

    render(<LandingPage />)
    
    const input = screen.getByPlaceholderText(/Enter GitHub Gist URL/)
    const submitButton = screen.getByText('Load Component')
    
    // Enter invalid URL
    fireEvent.change(input, { target: { value: 'invalid-url' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid GitHub Gist URL/)).toBeInTheDocument()
    })
  })

  it('handles loading states properly', async () => {
    mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

    render(<LandingPage />)
    
    // Should show loading initially
    expect(screen.getByText('Loading recent components...')).toBeInTheDocument()
    expect(screen.getByText('Loading popular components...')).toBeInTheDocument()
  })
})