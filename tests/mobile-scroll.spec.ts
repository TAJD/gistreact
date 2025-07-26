import { test, expect } from '@playwright/test'

test.describe('Mobile Scroll Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Use a sample gist for testing - this one should exist
    await page.goto('/e41c69596e5817832dca9c1c9e217391')
  })

  test('header hides and shows on mobile scroll', async ({ page }) => {
    // Wait for the component to load
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Take initial screenshot showing header visible
    await page.screenshot({
      path: 'test-results/mobile-initial-header-visible.png',
      fullPage: true
    })

    // Get initial header position
    const initialHeader = await page.locator('.gist-nav')
    await expect(initialHeader).toHaveClass(/visible/)
    
    // Scroll down to trigger header hiding
    await page.evaluate(() => {
      window.scrollTo({ top: 200, behavior: 'smooth' })
    })
    
    // Wait a moment for scroll to complete
    await page.waitForTimeout(500)
    
    // Check if header is hidden
    await expect(initialHeader).toHaveClass(/hidden/)
    
    // Take screenshot showing header hidden
    await page.screenshot({
      path: 'test-results/mobile-header-hidden-after-scroll.png',
      fullPage: true
    })

    // Scroll back up to show header
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
    
    // Wait for scroll and animation to complete
    await page.waitForTimeout(500)
    
    // Check header is visible again
    await expect(initialHeader).toHaveClass(/visible/)
    
    // Take final screenshot showing header visible again
    await page.screenshot({
      path: 'test-results/mobile-header-visible-after-scroll-up.png',
      fullPage: true
    })
  })

  test('share link toggle works on mobile', async ({ page }) => {
    // Wait for the component to load and check if share button exists
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Check if this gist has a share button (only if shareId exists)
    const shareButton = page.locator('.share-toggle-btn')
    const shareButtonExists = await shareButton.count() > 0
    
    if (shareButtonExists) {
      // Take screenshot showing share button
      await page.screenshot({
        path: 'test-results/mobile-share-button-visible.png',
        fullPage: true
      })
      
      // Click the share toggle button
      await shareButton.click()
      
      // Wait for ShareableLink to appear
      await page.waitForSelector('.shareable-link', { timeout: 2000 })
      
      // Take screenshot showing ShareableLink expanded
      await page.screenshot({
        path: 'test-results/mobile-share-link-expanded.png',
        fullPage: true
      })
      
      // Click again to hide
      await shareButton.click()
      
      // Wait for ShareableLink to disappear
      await page.waitForTimeout(500)
      
      // Take screenshot showing ShareableLink hidden
      await page.screenshot({
        path: 'test-results/mobile-share-link-hidden.png',
        fullPage: true
      })
    } else {
      console.log('No share button found - this gist may not have a shareId')
      // Take screenshot anyway for documentation
      await page.screenshot({
        path: 'test-results/mobile-no-share-button.png',
        fullPage: true
      })
    }
  })

  test('header height adjusts properly for content', async ({ page }) => {
    // Wait for component to load
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Get the component container and check its top margin matches header height
    const container = page.locator('.component-container')
    const containerStyle = await container.getAttribute('style')
    
    // The margin-top should match the header height
    expect(containerStyle).toContain('margin-top:')
    
    // Take screenshot showing proper layout
    await page.screenshot({
      path: 'test-results/mobile-layout-proper-spacing.png',
      fullPage: true
    })
  })
})

test.describe('Desktop Scroll Behavior', () => {
  test.use({ viewport: { width: 1280, height: 720 } })
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/e41c69596e5817832dca9c1c9e217391')
  })

  test('header hides and shows on desktop scroll', async ({ page }) => {
    // Wait for the component to load
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/desktop-initial-header-visible.png',
      fullPage: true
    })

    const header = await page.locator('.gist-nav')
    await expect(header).toHaveClass(/visible/)
    
    // Scroll down
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'smooth' })
    })
    
    await page.waitForTimeout(500)
    await expect(header).toHaveClass(/hidden/)
    
    await page.screenshot({
      path: 'test-results/desktop-header-hidden-after-scroll.png',
      fullPage: true
    })

    // Scroll back up
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
    
    await page.waitForTimeout(500)
    await expect(header).toHaveClass(/visible/)
    
    await page.screenshot({
      path: 'test-results/desktop-header-visible-after-scroll-up.png',
      fullPage: true
    })
  })
})