import { test, expect } from '@playwright/test'

test.describe('Share Button Demo', () => {
  test('demonstrate share button functionality with manual demo', async ({ page }) => {
    // Go to the landing page first
    await page.goto('/')
    
    // Take screenshot of landing page
    await page.screenshot({
      path: 'test-results/landing-page.png',
      fullPage: true
    })
    
    // Try a few different gist IDs to find one that might have sharing enabled
    const testGists = [
      'e41c69596e5817832dca9c1c9e217391', // sailing trip map
      '8f214d7', // from recent commits
      'd4a2307', // from recent commits
    ]
    
    for (const gistId of testGists) {
      await page.goto(`/${gistId}`)
      
      // Wait for component to load
      await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
      
      // Check if share button exists
      const shareButton = page.locator('.share-toggle-btn')
      const shareButtonExists = await shareButton.count() > 0
      
      if (shareButtonExists) {
        console.log(`Found share button for gist: ${gistId}`)
        
        // Take screenshot showing share button
        await page.screenshot({
          path: `test-results/gist-${gistId}-with-share-button.png`,
          fullPage: true
        })
        
        // Click to show share options
        await shareButton.click()
        await page.waitForTimeout(500)
        
        // Take screenshot showing expanded share options
        await page.screenshot({
          path: `test-results/gist-${gistId}-share-expanded.png`,
          fullPage: true
        })
        
        // Click to hide share options
        await shareButton.click()
        await page.waitForTimeout(500)
        
        // Take final screenshot
        await page.screenshot({
          path: `test-results/gist-${gistId}-share-hidden.png`,
          fullPage: true
        })
        
        break
      } else {
        console.log(`No share button for gist: ${gistId}`)
        
        // Take screenshot showing the normal header without share button
        await page.screenshot({
          path: `test-results/gist-${gistId}-no-share.png`,
          fullPage: true
        })
      }
    }
  })

  test('mobile header behavior demo', async ({ page }) => {
    // Test with mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/e41c69596e5817832dca9c1c9e217391')
    
    // Wait for component to load  
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Take initial mobile screenshot
    await page.screenshot({
      path: 'test-results/mobile-component-loaded.png',
      fullPage: true
    })
    
    // Test scroll behavior by scrolling down in the Sandpack iframe
    await page.evaluate(() => {
      // Try to scroll the main window
      window.scrollTo({ top: 100, behavior: 'smooth' })
    })
    
    await page.waitForTimeout(1000)
    
    // Take screenshot after scroll attempt
    await page.screenshot({
      path: 'test-results/mobile-after-scroll-attempt.png',
      fullPage: true
    })
    
    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
    
    await page.waitForTimeout(500)
    
    // Final mobile screenshot
    await page.screenshot({
      path: 'test-results/mobile-scroll-back-to-top.png',
      fullPage: true
    })
  })
})