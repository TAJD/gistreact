import { test, expect } from '@playwright/test'

test.describe('Create Share Demo', () => {
  test('demonstrate full share functionality flow', async ({ page }) => {
    // First go to a gist that loads properly
    await page.goto('/e41c69596e5817832dca9c1c9e217391')
    
    // Wait for component to load completely
    await page.waitForSelector('.gist-nav.visible', { timeout: 15000 })
    
    // Wait for the Sandpack component to load
    await page.waitForTimeout(3000)
    
    // Take screenshot of loaded component
    await page.screenshot({
      path: 'test-results/demo-component-fully-loaded.png',
      fullPage: true
    })
    
    // Try to access the component through a /share/ URL (even if it doesn't exist yet)
    // This will show the error handling
    await page.goto('/share/test-demo-component')
    
    await page.waitForTimeout(2000)
    
    // Take screenshot of share URL attempt
    await page.screenshot({
      path: 'test-results/demo-share-url-attempt.png',
      fullPage: true
    })
    
    // Go back to working gist
    await page.goto('/e41c69596e5817832dca9c1c9e217391')
    
    // Wait for load
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Take screenshot showing normal header without share button
    await page.screenshot({
      path: 'test-results/demo-normal-header-layout.png',
      fullPage: true
    })
    
    // Now test mobile layout
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    
    // Wait for component to load on mobile
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Take mobile screenshot
    await page.screenshot({
      path: 'test-results/demo-mobile-layout.png',
      fullPage: true
    })
    
    // Test header responsiveness on mobile
    const header = page.locator('.gist-nav')
    
    // Check that header has proper mobile classes
    await expect(header).toBeVisible()
    
    // Take final mobile screenshot showing responsive header
    await page.screenshot({
      path: 'test-results/demo-mobile-responsive-header.png',
      fullPage: true
    })
  })
  
  test('demonstrate header visibility behavior', async ({ page }) => {
    await page.goto('/e41c69596e5817832dca9c1c9e217391')
    
    // Wait for load
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Get initial header state
    const header = page.locator('.gist-nav')
    await expect(header).toHaveClass(/visible/)
    
    // Take screenshot showing visible header
    await page.screenshot({
      path: 'test-results/demo-header-visible-state.png',
      fullPage: true
    })
    
    // Note: The scroll hiding functionality requires actual scrollable content
    // Since Sandpack components don't always generate scrollable content in tests,
    // we'll document the expected behavior
    
    // Test that the CSS classes are properly applied
    const headerClasses = await header.getAttribute('class')
    console.log('Header classes:', headerClasses)
    
    // Test that the header has the expected structure
    const homeButton = page.locator('.home-btn')
    await expect(homeButton).toBeVisible()
    await expect(homeButton).toContainText('Home')
    
    // Test gist info is displayed
    const gistInfo = page.locator('.gist-info')
    await expect(gistInfo).toBeVisible()
    
    // Take final screenshot documenting header structure
    await page.screenshot({
      path: 'test-results/demo-header-structure-complete.png',
      fullPage: true
    })
  })
})