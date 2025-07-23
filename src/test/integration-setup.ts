import { vi } from 'vitest'

// Global mocks for integration tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}

// Mock Cloudflare environment
global.process = {
  ...process,
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
}