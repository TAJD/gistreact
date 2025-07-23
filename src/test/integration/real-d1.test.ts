import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { $ } from 'execa'
import { randomBytes } from 'crypto'

// This test uses actual D1 databases via wrangler CLI
describe('Real D1 Database Integration Tests', () => {
  let testDatabaseName: string
  let testDatabaseId: string

  beforeAll(async () => {
    // Generate unique database name for this test run
    testDatabaseName = `gist-analytics-test-${randomBytes(8).toString('hex')}`
    
    try {
      console.log(`Creating ephemeral D1 database: ${testDatabaseName}`)
      
      // Create ephemeral D1 database
      const createResult = await $`wrangler d1 create ${testDatabaseName}`
      console.log('Create output:', createResult.stdout)
      
      // Extract database ID from the create output
      const idMatch = createResult.stdout.match(/database_id\s*=\s*"([^"]+)"/)
      if (!idMatch) {
        console.error('Full wrangler output:', createResult.stdout)
        throw new Error('Could not extract database ID from wrangler output')
      }
      testDatabaseId = idMatch[1]
      console.log(`Created database with ID: ${testDatabaseId}`)
      
      // Initialize database schema
      console.log('Initializing database schema...')
      const schemaResult = await $`wrangler d1 execute ${testDatabaseName} --file=./schema.sql`
      console.log('Schema initialization result:', schemaResult.stdout)
      
    } catch (error) {
      console.error('Failed to setup test database:', error)
      throw error
    }
  }, 60000) // 60 second timeout for database setup

  afterAll(async () => {
    if (testDatabaseName) {
      try {
        console.log(`Cleaning up test database: ${testDatabaseName}`)
        await $`wrangler d1 delete ${testDatabaseName} --skip-confirmation`
        console.log('Test database cleaned up successfully')
      } catch (error) {
        console.warn('Failed to cleanup test database:', error)
      }
    }
  }, 30000) // 30 second timeout for cleanup

  describe('Schema Validation', () => {
    it('should have created all required tables', async () => {
      const result = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"`
      
      expect(result.stdout).toContain('gist_analytics')
      expect(result.stdout).toContain('stored_gists')
    })

    it('should have created all required indexes', async () => {
      const result = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"`
      
      expect(result.stdout).toContain('idx_gist_analytics_gist_id')
      expect(result.stdout).toContain('idx_gist_analytics_last_accessed')
      expect(result.stdout).toContain('idx_gist_analytics_view_count')
      expect(result.stdout).toContain('idx_stored_gists_share_id')
      expect(result.stdout).toContain('idx_stored_gists_original_gist_id')
    })
  })

  describe('Basic CRUD Operations', () => {
    it('should insert and retrieve gist analytics', async () => {
      const gistId = 'crud-test-gist-123'
      const filename = 'CrudTestComponent.tsx'
      
      // Insert a record
      await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ('${gistId}', '${filename}', 1)"`
      
      // Retrieve the record
      const result = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT * FROM gist_analytics WHERE gist_id = '${gistId}' AND filename = '${filename}'"`
      
      expect(result.stdout).toContain(gistId)
      expect(result.stdout).toContain(filename)
      expect(result.stdout).toContain('1') // view_count
    })

    it('should insert and retrieve stored gists', async () => {
      const shareId = 'crud-test-share-456'
      const originalGistId = 'crud-original-gist-789'
      const filename = 'CrudStoredComponent.tsx'
      const content = 'export default function CrudStored() { return <div>CRUD Test</div> }'
      
      // Insert a stored gist
      await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO stored_gists (share_id, original_gist_id, filename, content) VALUES ('${shareId}', '${originalGistId}', '${filename}', '${content}')"`
      
      // Retrieve the stored gist
      const result = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT * FROM stored_gists WHERE share_id = '${shareId}'"`
      
      expect(result.stdout).toContain(shareId)
      expect(result.stdout).toContain(originalGistId)
      expect(result.stdout).toContain(filename)
      expect(result.stdout).toContain('CRUD Test')
    })

    it('should update records correctly', async () => {
      const gistId = 'update-test-gist'
      const filename = 'UpdateTestComponent.tsx'
      
      // Insert initial record
      await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ('${gistId}', '${filename}', 1)"`
      
      // Update the record using UPSERT
      await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ('${gistId}', '${filename}', 1) ON CONFLICT(gist_id, filename) DO UPDATE SET view_count = view_count + 1"`
      
      // Verify the update
      const result = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT view_count FROM gist_analytics WHERE gist_id = '${gistId}' AND filename = '${filename}'"`
      
      expect(result.stdout).toContain('2') // Should be incremented to 2
    })
  })

  describe('Query Performance', () => {
    it('should handle bulk inserts and queries efficiently', async () => {
      // Insert multiple records for performance testing
      const insertCommands = []
      for (let i = 0; i < 50; i++) {
        insertCommands.push(`('perf-test-${i}', 'Component${i}.tsx', ${Math.floor(Math.random() * 100)})`)
      }
      
      const insertCommand = `INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ${insertCommands.join(', ')}`
      
      const insertStart = Date.now()
      await $`wrangler d1 execute ${testDatabaseName} --command="${insertCommand}"`
      const insertDuration = Date.now() - insertStart
      
      console.log(`Bulk insert of 50 records took ${insertDuration}ms`)
      expect(insertDuration).toBeLessThan(10000) // Should complete within 10 seconds
      
      // Test query performance
      const queryStart = Date.now()
      const result = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT gist_id, filename, view_count FROM gist_analytics ORDER BY view_count DESC LIMIT 10"`
      const queryDuration = Date.now() - queryStart
      
      console.log(`Query took ${queryDuration}ms`)
      expect(queryDuration).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.stdout).toContain('perf-test-') // Should return results
    })

    it('should utilize indexes for common queries', async () => {
      // Insert test data
      await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ('index-test-1', 'IndexTest1.tsx', 100), ('index-test-2', 'IndexTest2.tsx', 50)"`
      
      // Test gist_id index
      const gistIdQueryStart = Date.now()
      const gistIdResult = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT * FROM gist_analytics WHERE gist_id = 'index-test-1'"`
      const gistIdQueryDuration = Date.now() - gistIdQueryStart
      
      console.log(`Gist ID lookup took ${gistIdQueryDuration}ms`)
      expect(gistIdResult.stdout).toContain('index-test-1')
      expect(gistIdQueryDuration).toBeLessThan(2000)
      
      // Test view_count index  
      const viewCountQueryStart = Date.now()
      const viewCountResult = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT * FROM gist_analytics ORDER BY view_count DESC LIMIT 5"`
      const viewCountQueryDuration = Date.now() - viewCountQueryStart
      
      console.log(`View count query took ${viewCountQueryDuration}ms`)
      expect(viewCountResult.stdout).toContain('100') // Should find the highest view count first
      expect(viewCountQueryDuration).toBeLessThan(2000)
    })
  })

  describe('Data Integrity', () => {
    it('should enforce unique constraints', async () => {
      const gistId = 'unique-test-gist'
      const filename = 'UniqueTestComponent.tsx'
      
      // Insert first record
      await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ('${gistId}', '${filename}', 1)"`
      
      // Try to insert duplicate (should work with UPSERT)
      const upsertResult = await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ('${gistId}', '${filename}', 1) ON CONFLICT(gist_id, filename) DO UPDATE SET view_count = view_count + 1"`
      
      expect(upsertResult.stdout).not.toContain('error')
      
      // Verify only one record exists with incremented count
      const verifyResult = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT COUNT(*), view_count FROM gist_analytics WHERE gist_id = '${gistId}' AND filename = '${filename}'"`
      
      expect(verifyResult.stdout).toContain('1') // Only one record
      expect(verifyResult.stdout).toContain('2') // view_count should be 2
    })

    it('should enforce share_id uniqueness in stored_gists', async () => {
      const shareId = 'unique-share-test'
      
      // Insert first stored gist
      await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO stored_gists (share_id, original_gist_id, filename, content) VALUES ('${shareId}', 'gist1', 'Component1.tsx', 'content1')"`
      
      // Try to insert second gist with same share_id (should fail)
      try {
        await $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO stored_gists (share_id, original_gist_id, filename, content) VALUES ('${shareId}', 'gist2', 'Component2.tsx', 'content2')"`
        // If we reach here, the constraint didn't work
        expect(true).toBe(false)
      } catch (error) {
        // Should throw due to unique constraint violation
        expect(error.message || error.stdout || error.stderr).toContain('UNIQUE constraint failed')
      }
    })
  })

  describe('Transaction Behavior', () => {
    it('should handle concurrent access patterns', async () => {
      const gistId = 'concurrent-test-gist'
      const filename = 'ConcurrentTestComponent.tsx'
      
      // Simulate multiple concurrent view increments
      const concurrentPromises = []
      for (let i = 0; i < 5; i++) {
        concurrentPromises.push(
          $`wrangler d1 execute ${testDatabaseName} --command="INSERT INTO gist_analytics (gist_id, filename, view_count) VALUES ('${gistId}', '${filename}', 1) ON CONFLICT(gist_id, filename) DO UPDATE SET view_count = view_count + 1"`
        )
      }
      
      // Wait for all to complete
      await Promise.all(concurrentPromises)
      
      // Verify final count (should be 5)
      const result = await $`wrangler d1 execute ${testDatabaseName} --command="SELECT view_count FROM gist_analytics WHERE gist_id = '${gistId}' AND filename = '${filename}'"`
      
      expect(result.stdout).toContain('5')
    })
  })
})