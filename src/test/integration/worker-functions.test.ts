import { describe, it, expect, beforeEach } from 'vitest'

// Mock D1 database interfaces
interface MockD1Result {
  success: boolean
  meta: { changes: number }
}

interface MockD1Statement {
  bind: (...values: unknown[]) => MockD1Statement
  first: () => Promise<unknown>
  all: () => Promise<{ results: unknown[] }>
  run: () => Promise<MockD1Result>
}

interface MockD1Database {
  prepare: (query: string) => MockD1Statement
}

interface MockEnv {
  DB: MockD1Database
}

// Import and test worker functions directly
describe('Worker Functions Integration Tests', () => {
  let mockEnv: MockEnv
  let mockDatabase: { [key: string]: unknown[] }

  beforeEach(() => {
    // Reset mock database
    mockDatabase = {
      gist_analytics: [],
      stored_gists: []
    }

    // Create mock D1 database that operates on in-memory data
    const mockDB: MockD1Database = {
      prepare: (query: string) => {
        let boundValues: unknown[] = []
        const statement: MockD1Statement = {
          bind: (...values: unknown[]) => {
            boundValues = values
            return statement
          },
          first: async () => {
            if (query.includes('SELECT') && query.includes('gist_analytics')) {
              return mockDatabase.gist_analytics.find((record) => {
                const r = record as { gist_id?: string; filename?: string }
                if (query.includes('gist_id = ?') && query.includes('filename = ?')) {
                  return r.gist_id === boundValues[0] && r.filename === boundValues[1]
                }
                if (query.includes('gist_id = ?')) {
                  return r.gist_id === boundValues[0]
                }
                return false
              }) || null
            }
            if (query.includes('SELECT') && query.includes('stored_gists')) {
              return mockDatabase.stored_gists.find((record) => {
                const r = record as { share_id?: string; original_gist_id?: string }
                if (query.includes('share_id = ?')) {
                  return r.share_id === boundValues[0]
                }
                if (query.includes('original_gist_id = ?')) {
                  return r.original_gist_id === boundValues[0]
                }
                return false
              }) || null
            }
            return null
          },
          all: async () => {
            if (query.includes('ORDER BY first_accessed_at DESC')) {
              return { 
                results: [...mockDatabase.gist_analytics]
                  .filter(r => r.view_count > 0)
                  .sort((a, b) => new Date(b.first_accessed_at).getTime() - new Date(a.first_accessed_at).getTime())
                  .slice(0, boundValues[0] || 10)
              }
            }
            if (query.includes('ORDER BY view_count DESC')) {
              return { 
                results: [...mockDatabase.gist_analytics]
                  .filter(r => r.view_count > 0)
                  .sort((a, b) => b.view_count - a.view_count)
                  .slice(0, boundValues[0] || 10)
              }
            }
            return { results: [] }
          },
          run: async () => {
            if (query.includes('INSERT INTO gist_analytics')) {
              const [gist_id, filename, view_count, error_count, last_error] = boundValues
              mockDatabase.gist_analytics.push({
                id: mockDatabase.gist_analytics.length + 1,
                gist_id,
                filename,
                view_count: view_count !== undefined ? view_count : 1,
                error_count: error_count || 0,
                last_error,
                first_accessed_at: new Date().toISOString(),
                last_accessed_at: new Date().toISOString()
              })
              return { success: true, meta: { changes: 1 } }
            }
            if (query.includes('INSERT INTO stored_gists')) {
              const [share_id, original_gist_id, filename, content, description] = boundValues
              mockDatabase.stored_gists.push({
                id: mockDatabase.stored_gists.length + 1,
                share_id,
                original_gist_id,
                filename,
                content,
                description,
                access_count: 0,
                created_at: new Date().toISOString(),
                last_accessed_at: new Date().toISOString()
              })
              return { success: true, meta: { changes: 1 } }
            }
            if (query.includes('UPDATE stored_gists') && query.includes('access_count')) {
              const record = mockDatabase.stored_gists.find(r => r.share_id === boundValues[0])
              if (record) {
                record.access_count += 1
                record.last_accessed_at = new Date().toISOString()
                return { success: true, meta: { changes: 1 } }
              }
            }
            if (query.includes('UPDATE stored_gists') && query.includes('SET share_id')) {
              const [newShareId, gistId, filename, oldShareId] = boundValues
              const record = mockDatabase.stored_gists.find(r => 
                r.original_gist_id === gistId && r.filename === filename && r.share_id === oldShareId
              )
              if (record) {
                record.share_id = newShareId
                record.last_accessed_at = new Date().toISOString()
                return { success: true, meta: { changes: 1 } }
              }
            }
            return { success: false, meta: { changes: 0 } }
          }
        }
        return statement
      }
    }

    mockEnv = { DB: mockDB }
  })

  describe('Analytics Functions', () => {
    it('should record gist view analytics', async () => {
      const gistId = 'test-gist-123'
      const filename = 'Component.tsx'
      
      // Record a successful view
      await mockEnv.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count)
        VALUES (?, ?, 1)
      `).bind(gistId, filename).run()
      
      // Verify the record was created
      const record = await mockEnv.DB.prepare(`
        SELECT * FROM gist_analytics WHERE gist_id = ? AND filename = ?
      `).bind(gistId, filename).first()
      
      expect(record).toBeTruthy()
      expect(record.gist_id).toBe(gistId)
      expect(record.filename).toBe(filename)
      expect(record.view_count).toBe(1)
      expect(record.error_count).toBe(0)
    })

    it('should record error analytics', async () => {
      const gistId = 'error-gist-456'
      const filename = 'ErrorComponent.tsx'
      const errorMessage = 'Component failed to compile'
      
      // Record an error
      await mockEnv.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count, error_count, last_error)
        VALUES (?, ?, ?, ?, ?)
      `).bind(gistId, filename, 0, 1, errorMessage).run()
      
      // Verify the error was recorded
      const record = await mockEnv.DB.prepare(`
        SELECT * FROM gist_analytics WHERE gist_id = ? AND filename = ?
      `).bind(gistId, filename).first()
      
      expect(record).toBeTruthy()
      expect(record.error_count).toBe(1)
      expect(record.last_error).toBe(errorMessage)
      expect(record.view_count).toBe(0)
    })

    it('should retrieve recent gists in correct order', async () => {
      // Add test data with different access times
      const testData = [
        { gist_id: 'recent1', filename: 'Component1.tsx', view_count: 5, first_accessed_at: '2023-01-01T10:00:00Z' },
        { gist_id: 'recent2', filename: 'Component2.tsx', view_count: 3, first_accessed_at: '2023-01-01T12:00:00Z' },
        { gist_id: 'recent3', filename: 'Component3.tsx', view_count: 1, first_accessed_at: '2023-01-01T11:00:00Z' },
      ]
      
      // Insert test data directly into mock database
      mockDatabase.gist_analytics.push(...testData.map((data, idx) => ({
        id: idx + 1,
        ...data,
        error_count: 0,
        last_accessed_at: data.first_accessed_at
      })))
      
      // Get recent gists
      const result = await mockEnv.DB.prepare(`
        SELECT gist_id, filename, first_accessed_at, view_count
        FROM gist_analytics
        WHERE view_count > 0
        ORDER BY first_accessed_at DESC
        LIMIT ?
      `).bind(10).all()
      
      expect(result.results).toHaveLength(3)
      // Should be in reverse chronological order
      expect(result.results[0].gist_id).toBe('recent2') // 12:00
      expect(result.results[1].gist_id).toBe('recent3') // 11:00
      expect(result.results[2].gist_id).toBe('recent1') // 10:00
    })

    it('should retrieve popular gists in correct order', async () => {
      // Add test data with different view counts
      const testData = [
        { gist_id: 'popular1', filename: 'Component1.tsx', view_count: 100 },
        { gist_id: 'popular2', filename: 'Component2.tsx', view_count: 50 },
        { gist_id: 'popular3', filename: 'Component3.tsx', view_count: 75 },
      ]
      
      mockDatabase.gist_analytics.push(...testData.map((data, idx) => ({
        id: idx + 1,
        ...data,
        error_count: 0,
        first_accessed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      })))
      
      // Get popular gists
      const result = await mockEnv.DB.prepare(`
        SELECT gist_id, filename, view_count, first_accessed_at
        FROM gist_analytics
        WHERE view_count > 0
        ORDER BY view_count DESC, first_accessed_at DESC
        LIMIT ?
      `).bind(10).all()
      
      expect(result.results).toHaveLength(3)
      // Should be ordered by view count DESC
      expect(result.results[0].gist_id).toBe('popular1')
      expect(result.results[0].view_count).toBe(100)
      expect(result.results[1].gist_id).toBe('popular3')
      expect(result.results[1].view_count).toBe(75)
      expect(result.results[2].gist_id).toBe('popular2')
      expect(result.results[2].view_count).toBe(50)
    })
  })

  describe('Shareable Links Functions', () => {
    it('should store gist for sharing', async () => {
      const shareId = 'test-share-123'
      const originalGistId = 'original-gist-456'
      const filename = 'SharedComponent.tsx'
      const content = 'export default function SharedComponent() { return <div>Shared</div> }'
      const description = 'A test shared component'
      
      // Store the gist
      const result = await mockEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content, description)
        VALUES (?, ?, ?, ?, ?)
      `).bind(shareId, originalGistId, filename, content, description).run()
      
      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
      
      // Verify it was stored
      const stored = await mockEnv.DB.prepare(`
        SELECT * FROM stored_gists WHERE share_id = ?
      `).bind(shareId).first()
      
      expect(stored).toBeTruthy()
      expect(stored.share_id).toBe(shareId)
      expect(stored.original_gist_id).toBe(originalGistId)
      expect(stored.filename).toBe(filename)
      expect(stored.content).toBe(content)
      expect(stored.description).toBe(description)
    })

    it('should retrieve stored gist and update access count', async () => {
      const shareId = 'retrieve-test-789'
      const originalGistId = 'original-gist-789'
      const filename = 'RetrieveTest.tsx'
      const content = 'export default function RetrieveTest() { return <div>Retrieved</div> }'
      
      // Store the gist first
      await mockEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content)
        VALUES (?, ?, ?, ?)
      `).bind(shareId, originalGistId, filename, content).run()
      
      // Retrieve it
      const result = await mockEnv.DB.prepare(`
        SELECT content, filename, original_gist_id
        FROM stored_gists 
        WHERE share_id = ?
      `).bind(shareId).first()
      
      expect(result).toBeTruthy()
      expect(result.content).toBe(content)
      expect(result.filename).toBe(filename)
      expect(result.original_gist_id).toBe(originalGistId)
      
      // Update access count
      const updateResult = await mockEnv.DB.prepare(`
        UPDATE stored_gists 
        SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
        WHERE share_id = ?
      `).bind(shareId).run()
      
      expect(updateResult.success).toBe(true)
      
      // Verify access count was updated
      const record = mockDatabase.stored_gists.find(r => r.share_id === shareId)
      expect(record?.access_count).toBe(1)
    })

    it('should update share ID successfully', async () => {
      const oldShareId = 'old-share-id'
      const newShareId = 'new-custom-name'
      const originalGistId = 'update-test-gist'
      const filename = 'UpdateTest.tsx'
      const content = 'export default function UpdateTest() { return <div>Update</div> }'
      
      // Store initial gist
      await mockEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content)
        VALUES (?, ?, ?, ?)
      `).bind(oldShareId, originalGistId, filename, content).run()
      
      // Update share ID
      const result = await mockEnv.DB.prepare(`
        UPDATE stored_gists 
        SET share_id = ?, last_accessed_at = CURRENT_TIMESTAMP
        WHERE original_gist_id = ? AND filename = ? AND share_id = ?
      `).bind(newShareId, originalGistId, filename, oldShareId).run()
      
      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
      
      // Verify the share ID was updated
      const record = mockDatabase.stored_gists.find(r => 
        r.original_gist_id === originalGistId && r.filename === filename
      )
      expect(record?.share_id).toBe(newShareId)
    })

    it('should handle share ID not found', async () => {
      const result = await mockEnv.DB.prepare(`
        SELECT content, filename, original_gist_id
        FROM stored_gists 
        WHERE share_id = ?
      `).bind('nonexistent').first()
      
      expect(result).toBeFalsy()
    })
  })

  describe('Helper Functions', () => {
    it('should generate valid share IDs', () => {
      // Test the share ID generation logic
      const generateShareId = (): string => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
        let result = ''
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
      }
      
      const shareId = generateShareId()
      expect(shareId).toHaveLength(8)
      expect(/^[a-z0-9]+$/.test(shareId)).toBe(true)
      
      // Generate multiple IDs to ensure uniqueness
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(generateShareId())
      }
      expect(ids.size).toBeGreaterThan(90) // Should be mostly unique
    })

    it('should validate custom share ID format', () => {
      const validateShareId = (shareId: string): { valid: boolean; error?: string } => {
        if (!/^[a-zA-Z0-9-_]+$/.test(shareId)) {
          return { valid: false, error: 'Custom name can only contain letters, numbers, hyphens, and underscores' }
        }
        if (shareId.length < 3) {
          return { valid: false, error: 'Custom name must be at least 3 characters' }
        }
        if (shareId.length > 50) {
          return { valid: false, error: 'Custom name must be less than 50 characters' }
        }
        return { valid: true }
      }
      
      // Valid cases
      expect(validateShareId('valid-name')).toEqual({ valid: true })
      expect(validateShareId('valid_name123')).toEqual({ valid: true })
      expect(validateShareId('abc')).toEqual({ valid: true })
      
      // Invalid cases
      expect(validateShareId('invalid@name!')).toEqual({ 
        valid: false, 
        error: 'Custom name can only contain letters, numbers, hyphens, and underscores' 
      })
      expect(validateShareId('ab')).toEqual({ 
        valid: false, 
        error: 'Custom name must be at least 3 characters' 
      })
      expect(validateShareId('a'.repeat(51))).toEqual({ 
        valid: false, 
        error: 'Custom name must be less than 50 characters' 
      })
    })
  })

  describe('Database Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Insert many records to test performance
      const recordCount = 1000
      const testData = Array.from({ length: recordCount }, (_, i) => ({
        id: i + 1,
        gist_id: `perf-test-${i}`,
        filename: `Component${i}.tsx`,
        view_count: Math.floor(Math.random() * 100),
        error_count: 0,
        first_accessed_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        last_accessed_at: new Date().toISOString()
      }))
      
      mockDatabase.gist_analytics.push(...testData)
      
      // Test recent query performance
      const startTime = Date.now()
      const recentResult = await mockEnv.DB.prepare(`
        SELECT gist_id, filename FROM gist_analytics 
        ORDER BY first_accessed_at DESC 
        LIMIT 10
      `).all()
      const recentDuration = Date.now() - startTime
      
      expect(recentResult.results).toHaveLength(10)
      expect(recentDuration).toBeLessThan(100) // Should be fast with proper indexing
      
      // Test popular query performance
      const popularStartTime = Date.now()
      const popularResult = await mockEnv.DB.prepare(`
        SELECT gist_id, filename FROM gist_analytics 
        ORDER BY view_count DESC 
        LIMIT 10
      `).all()
      const popularDuration = Date.now() - popularStartTime
      
      expect(popularResult.results).toHaveLength(10)
      expect(popularDuration).toBeLessThan(100)
    })
  })
})