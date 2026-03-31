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
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve([]),
    })
  })

  it('renders the landing page with main elements', () => {
    render(<LandingPage />)

    expect(screen.getByText('ReactDrop')).toBeInTheDocument()
    expect(screen.getByText(/Host and share React components/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/gist.github.com/)).toBeInTheDocument()
  })

  it('displays recent and popular sections', async () => {
    render(<LandingPage />)

    await waitFor(() => {
      expect(screen.getByText('Recent Components')).toBeInTheDocument()
      expect(screen.getByText('Popular Components')).toBeInTheDocument()
    })
  })

  it('handles gist URL submission', async () => {
    render(<LandingPage />)

    const input = screen.getByPlaceholderText(/gist.github.com/)
    const submitButton = screen.getByText('View Component')

    fireEvent.change(input, { target: { value: 'https://gist.github.com/user/abc123def456789012345678901234ab' } })
    fireEvent.click(submitButton)

    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/abc123def456789012345678901234ab')
    expect(mockDispatchEvent).toHaveBeenCalledWith(expect.any(PopStateEvent))
  })

  it('shows error for invalid URL', async () => {
    render(<LandingPage />)

    const input = screen.getByPlaceholderText(/gist.github.com/)
    const submitButton = screen.getByText('View Component')

    fireEvent.change(input, { target: { value: 'invalid-url' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Invalid GitHub Gist URL/)).toBeInTheDocument()
    })
  })

  it('shows validate CTA button', () => {
    render(<LandingPage />)

    expect(screen.getByText(/Validate Your Component/)).toBeInTheDocument()
  })
})
