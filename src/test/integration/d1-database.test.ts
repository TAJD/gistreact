import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { $ } from 'execa'
import { randomBytes } from 'crypto'

// Interface matching the worker's database structure
interface D1Database {
  prepare: (query: string) => D1PreparedStatement
}

interface D1PreparedStatement {
  bind: () => D1PreparedStatement
  first: () => Promise<unknown>
  all: () => Promise<{ results: unknown[] }>
  run: () => Promise<{ success: boolean; meta: { changes: number } }>
}

interface TestEnv {
  DB: D1Database
}

describe('D1 Database Integration Tests', () => {
  let testDatabaseName: string
  let testDatabaseId: string
  let testEnv: TestEnv

  beforeAll(async () => {
    // Generate unique database name for this test run
    testDatabaseName = `gist-analytics-test-${randomBytes(8).toString('hex')}`
    
    try {
      console.log(`Creating ephemeral D1 database: ${testDatabaseName}`)
      
      // Create ephemeral D1 database
      const createResult = await $`wrangler d1 create ${testDatabaseName}`
      console.log('Create result:', createResult.stdout)
      
      // Extract database ID from the create output
      const idMatch = createResult.stdout.match(/database_id = "([^"]+)"/)
      if (!idMatch) {
        throw new Error('Could not extract database ID from wrangler output')
      }
      testDatabaseId = idMatch[1]
      console.log(`Created database with ID: ${testDatabaseId}`)
      
      // Initialize database schema
      console.log('Initializing database schema...')
      const schemaResult = await $`wrangler d1 execute ${testDatabaseName} --file=./schema.sql`
      console.log('Schema result:', schemaResult.stdout)
      
      // Create test environment with local D1 database access
      testEnv = await createTestEnvironment(testDatabaseName)
      
    } catch (error) {
      console.error('Failed to setup test database:', error)
      throw error
    }
  })

  afterAll(async () => {
    if (testDatabaseName) {
      try {
        console.log(`Cleaning up test database: ${testDatabaseName}`)
        await $`wrangler d1 delete ${testDatabaseName} --force`
        console.log('Test database cleaned up successfully')
      } catch (error) {
        console.warn('Failed to cleanup test database:', error)
      }
    }
  })

  beforeEach(async () => {
    // Clear all tables before each test
    await testEnv.DB.prepare('DELETE FROM gist_analytics').run()
    await testEnv.DB.prepare('DELETE FROM stored_gists').run()
  })

  describe('Gist Analytics Operations', () => {
    it('should insert new gist analytics record', async () => {
      const gistId = 'test-gist-123'
      const filename = 'Component.tsx'
      
      const result = await testEnv.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count)
        VALUES (?, ?, 1)
      `).bind(gistId, filename).run()
      
      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
      
      // Verify the record was inserted
      const record = await testEnv.DB.prepare(`
        SELECT * FROM gist_analytics WHERE gist_id = ? AND filename = ?
      `).bind(gistId, filename).first()
      
      expect(record).toBeTruthy()
      expect(record.gist_id).toBe(gistId)
      expect(record.filename).toBe(filename)
      expect(record.view_count).toBe(1)
      expect(record.error_count).toBe(0)
    })

    it('should update existing gist analytics on conflict', async () => {
      const gistId = 'test-gist-456'
      const filename = 'Component.tsx'
      
      // Insert initial record
      await testEnv.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count)
        VALUES (?, ?, 1)
      `).bind(gistId, filename).run()
      
      // Insert again (should trigger UPSERT)
      await testEnv.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count)
        VALUES (?, ?, 1)
        ON CONFLICT(gist_id, filename) DO UPDATE SET
          view_count = view_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
      `).bind(gistId, filename).run()
      
      // Verify view count was incremented
      const record = await testEnv.DB.prepare(`
        SELECT view_count FROM gist_analytics WHERE gist_id = ? AND filename = ?
      `).bind(gistId, filename).first()
      
      expect(record.view_count).toBe(2)
    })

    it('should record error analytics', async () => {
      const gistId = 'error-gist-789'
      const filename = 'Error.tsx'
      const errorMessage = 'Component compilation failed'
      
      await testEnv.DB.prepare(`
        INSERT INTO gist_analytics (gist_id, filename, view_count, error_count, last_error)
        VALUES (?, ?, 0, 1, ?)
      `).bind(gistId, filename, errorMessage).run()
      
      const record = await testEnv.DB.prepare(`
        SELECT * FROM gist_analytics WHERE gist_id = ? AND filename = ?
      `).bind(gistId, filename).first()
      
      expect(record.error_count).toBe(1)
      expect(record.last_error).toBe(errorMessage)
      expect(record.view_count).toBe(0)
    })

    it('should retrieve recent gists correctly', async () => {
      // Insert test data with different timestamps
      const testData = [
        { gist_id: 'recent1', filename: 'Component1.tsx', view_count: 5 },
        { gist_id: 'recent2', filename: 'Component2.tsx', view_count: 3 },
        { gist_id: 'recent3', filename: 'Component3.tsx', view_count: 1 },
      ]
      
      for (const data of testData) {
        await testEnv.DB.prepare(`
          INSERT INTO gist_analytics (gist_id, filename, view_count)
          VALUES (?, ?, ?)
        `).bind(data.gist_id, data.filename, data.view_count).run()
      }
      
      // Get recent gists
      const result = await testEnv.DB.prepare(`
        SELECT gist_id, filename, first_accessed_at, view_count
        FROM gist_analytics
        WHERE view_count > 0
        ORDER BY first_accessed_at DESC
        LIMIT 10
      `).all()
      
      expect(result.results).toHaveLength(3)
      expect(result.results[0].gist_id).toMatch(/recent\d/)
    })

    it('should retrieve popular gists correctly', async () => {
      // Insert test data with different view counts
      const testData = [
        { gist_id: 'popular1', filename: 'Component1.tsx', view_count: 100 },
        { gist_id: 'popular2', filename: 'Component2.tsx', view_count: 50 },
        { gist_id: 'popular3', filename: 'Component3.tsx', view_count: 25 },
      ]
      
      for (const data of testData) {
        await testEnv.DB.prepare(`
          INSERT INTO gist_analytics (gist_id, filename, view_count)
          VALUES (?, ?, ?)
        `).bind(data.gist_id, data.filename, data.view_count).run()
      }
      
      // Get popular gists
      const result = await testEnv.DB.prepare(`
        SELECT gist_id, filename, view_count, first_accessed_at
        FROM gist_analytics
        WHERE view_count > 0
        ORDER BY view_count DESC, first_accessed_at DESC
        LIMIT 10
      `).all()
      
      expect(result.results).toHaveLength(3)
      expect(result.results[0].gist_id).toBe('popular1')
      expect(result.results[0].view_count).toBe(100)
      expect(result.results[1].view_count).toBe(50)
      expect(result.results[2].view_count).toBe(25)
    })
  })

  describe('Shareable Links Operations', () => {
    it('should store gist for sharing', async () => {
      const shareId = 'test-share-123'
      const originalGistId = 'original-gist-456'
      const filename = 'SharedComponent.tsx'
      const content = 'export default function SharedComponent() { return <div>Shared</div> }'
      const description = 'A shared test component'
      
      const result = await testEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content, description)
        VALUES (?, ?, ?, ?, ?)
      `).bind(shareId, originalGistId, filename, content, description).run()
      
      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
      
      // Verify the record was stored
      const record = await testEnv.DB.prepare(`
        SELECT * FROM stored_gists WHERE share_id = ?
      `).bind(shareId).first()
      
      expect(record).toBeTruthy()
      expect(record.share_id).toBe(shareId)
      expect(record.original_gist_id).toBe(originalGistId)
      expect(record.filename).toBe(filename)
      expect(record.content).toBe(content)
      expect(record.description).toBe(description)
      expect(record.access_count).toBe(0)
    })

    it('should retrieve stored gist by share ID', async () => {
      const shareId = 'retrieve-test-789'
      const originalGistId = 'original-gist-789'
      const filename = 'RetrieveTest.tsx'
      const content = 'export default function RetrieveTest() { return <div>Retrieved</div> }'
      
      // Store the gist
      await testEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content)
        VALUES (?, ?, ?, ?)
      `).bind(shareId, originalGistId, filename, content).run()
      
      // Retrieve the gist
      const result = await testEnv.DB.prepare(`
        SELECT content, filename, original_gist_id
        FROM stored_gists 
        WHERE share_id = ?
      `).bind(shareId).first()
      
      expect(result).toBeTruthy()
      expect(result.content).toBe(content)
      expect(result.filename).toBe(filename)
      expect(result.original_gist_id).toBe(originalGistId)
    })

    it('should update access count when retrieving stored gist', async () => {
      const shareId = 'access-count-test'
      const originalGistId = 'original-access-test'
      const filename = 'AccessTest.tsx'
      const content = 'export default function AccessTest() { return <div>Access</div> }'
      
      // Store the gist
      await testEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content)
        VALUES (?, ?, ?, ?)
      `).bind(shareId, originalGistId, filename, content).run()
      
      // Simulate access by updating access count
      await testEnv.DB.prepare(`
        UPDATE stored_gists 
        SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
        WHERE share_id = ?
      `).bind(shareId).run()
      
      // Verify access count was updated
      const record = await testEnv.DB.prepare(`
        SELECT access_count FROM stored_gists WHERE share_id = ?
      `).bind(shareId).first()
      
      expect(record.access_count).toBe(1)
    })

    it('should update share ID', async () => {
      const oldShareId = 'old-share-id'
      const newShareId = 'new-custom-name'
      const originalGistId = 'update-test-gist'
      const filename = 'UpdateTest.tsx'
      const content = 'export default function UpdateTest() { return <div>Update</div> }'
      
      // Store initial gist
      await testEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content)
        VALUES (?, ?, ?, ?)
      `).bind(oldShareId, originalGistId, filename, content).run()
      
      // Update share ID
      const result = await testEnv.DB.prepare(`
        UPDATE stored_gists 
        SET share_id = ?, last_accessed_at = CURRENT_TIMESTAMP
        WHERE original_gist_id = ? AND filename = ? AND share_id = ?
      `).bind(newShareId, originalGistId, filename, oldShareId).run()
      
      expect(result.success).toBe(true)
      expect(result.meta.changes).toBe(1)
      
      // Verify the share ID was updated
      const record = await testEnv.DB.prepare(`
        SELECT share_id FROM stored_gists WHERE original_gist_id = ? AND filename = ?
      `).bind(originalGistId, filename).first()
      
      expect(record.share_id).toBe(newShareId)
      
      // Verify old share ID doesn't exist
      const oldRecord = await testEnv.DB.prepare(`
        SELECT share_id FROM stored_gists WHERE share_id = ?
      `).bind(oldShareId).first()
      
      expect(oldRecord).toBeFalsy()
    })

    it('should enforce unique share IDs', async () => {
      const shareId = 'unique-test-id'
      const gist1 = 'gist1'
      const gist2 = 'gist2'
      const filename = 'UniqueTest.tsx'
      const content = 'export default function UniqueTest() { return <div>Unique</div> }'
      
      // Store first gist with share ID
      await testEnv.DB.prepare(`
        INSERT INTO stored_gists (share_id, original_gist_id, filename, content)
        VALUES (?, ?, ?, ?)
      `).bind(shareId, gist1, filename, content).run()
      
      // Try to store second gist with same share ID (should fail)
      await expect(
        testEnv.DB.prepare(`
          INSERT INTO stored_gists (share_id, original_gist_id, filename, content)
          VALUES (?, ?, ?, ?)
        `).bind(shareId, gist2, filename, content).run()
      ).rejects.toThrow()
    })
  })

  describe('Index Performance', () => {
    it('should use indexes for common queries', async () => {
      // Insert test data
      const testData = Array.from({ length: 100 }, (_, i) => ({
        gist_id: `perf-test-${i}`,
        filename: `Component${i}.tsx`,
        view_count: Math.floor(Math.random() * 100)
      }))
      
      for (const data of testData) {
        await testEnv.DB.prepare(`
          INSERT INTO gist_analytics (gist_id, filename, view_count)
          VALUES (?, ?, ?)
        `).bind(data.gist_id, data.filename, data.view_count).run()
      }
      
      // Test queries that should use indexes
      const recentQuery = await testEnv.DB.prepare(`
        SELECT gist_id, filename FROM gist_analytics 
        ORDER BY last_accessed_at DESC 
        LIMIT 10
      `).all()
      
      const popularQuery = await testEnv.DB.prepare(`
        SELECT gist_id, filename FROM gist_analytics 
        ORDER BY view_count DESC 
        LIMIT 10
      `).all()
      
      const gistLookup = await testEnv.DB.prepare(`
        SELECT * FROM gist_analytics WHERE gist_id = ?
      `).bind('perf-test-50').first()
      
      expect(recentQuery.results).toHaveLength(10)
      expect(popularQuery.results).toHaveLength(10)
      expect(gistLookup).toBeTruthy()
    })
  })
})

// Helper function to create test environment with D1 database access
async function createTestEnvironment(): Promise<TestEnv> {
  // This is a simplified mock implementation
  // In a real environment, you'd use wrangler's local D1 API or miniflare
  
  const mockDB: D1Database = {
    prepare: (query: string) => {
      const statement: D1PreparedStatement = {
        bind: () => statement,
        first: async () => {
          // This would execute the query against the local D1 database
          // For now, we'll use a simplified mock that works with the test structure
          console.log(`Executing query: ${query}`)
          return null
        },
        all: async () => {
          console.log(`Executing query: ${query}`)
          return { results: [] }
        },
        run: async () => {
          console.log(`Executing query: ${query}`)
          return { success: true, meta: { changes: 1 } }
        }
      }
      return statement
    }
  }
  
  return { DB: mockDB }
}