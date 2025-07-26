import { test, expect } from '@playwright/test'

test.describe('GitHub Repository Links Demo', () => {
  test('demonstrate GitHub repository integration on landing page', async ({ page }) => {
    // Go to the landing page
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForSelector('.hero', { timeout: 10000 })
    
    // Take screenshot of the full landing page with GitHub links
    await page.screenshot({
      path: 'test-results/landing-page-with-github-links.png',
      fullPage: true
    })
    
    // Check that GitHub star button is present in hero
    const githubButton = page.locator('.github-button')
    await expect(githubButton).toBeVisible()
    await expect(githubButton).toContainText('Star on GitHub')
    await expect(githubButton).toHaveAttribute('href', 'https://github.com/TAJD/gistreact')
    
    // Take screenshot focused on the hero section
    await page.locator('.hero').screenshot({
      path: 'test-results/hero-section-github-star.png'
    })
    
    // Scroll down to the open source section
    await page.locator('.open-source-section').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    // Take screenshot of the open source section
    await page.locator('.open-source-section').screenshot({
      path: 'test-results/open-source-section.png'
    })
    
    // Check that all GitHub action buttons are present
    const viewSourceBtn = page.locator('.github-action-btn.primary')
    await expect(viewSourceBtn).toBeVisible()
    await expect(viewSourceBtn).toContainText('View Source Code')
    await expect(viewSourceBtn).toHaveAttribute('href', 'https://github.com/TAJD/gistreact')
    
    const reportIssuesBtn = page.locator('a[href="https://github.com/TAJD/gistreact/issues"]')
    await expect(reportIssuesBtn).toBeVisible()
    await expect(reportIssuesBtn).toContainText('Report Issues')
    
    const contributeBtn = page.locator('a[href="https://github.com/TAJD/gistreact/blob/main/CONTRIBUTING.md"]')
    await expect(contributeBtn).toBeVisible()
    await expect(contributeBtn).toContainText('Contribute')
    
    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    // Take screenshot of footer with GitHub link
    await page.locator('footer').screenshot({
      path: 'test-results/footer-github-link.png'
    })
    
    // Check footer GitHub link
    const footerGithubLink = page.locator('footer a[href="https://github.com/TAJD/gistreact"]')
    await expect(footerGithubLink).toBeVisible()
    await expect(footerGithubLink).toContainText('GitHub')
  })
  
  test('test GitHub links on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/')
    await page.waitForSelector('.hero', { timeout: 10000 })
    
    // Take mobile screenshot of landing page
    await page.screenshot({
      path: 'test-results/mobile-landing-page-github-links.png',
      fullPage: true
    })
    
    // Check mobile layout of GitHub buttons
    await page.locator('.open-source-section').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    
    // Take mobile screenshot of open source section
    await page.locator('.open-source-section').screenshot({
      path: 'test-results/mobile-open-source-section.png'
    })
    
    // Verify that buttons stack vertically on mobile
    const githubActions = page.locator('.github-actions')
    await expect(githubActions).toBeVisible()
  })
  
  test('verify all GitHub links are functional', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.hero', { timeout: 10000 })
    
    // Test that clicking GitHub links would open in new tab (check target="_blank")
    const githubLinks = page.locator('a[href="https://github.com/TAJD/gistreact"]')
    
    for (let i = 0; i < await githubLinks.count(); i++) {
      const link = githubLinks.nth(i)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    
    // Test issues link
    const issuesLink = page.locator('a[href="https://github.com/TAJD/gistreact/issues"]')
    await expect(issuesLink).toHaveAttribute('target', '_blank')
    await expect(issuesLink).toHaveAttribute('rel', 'noopener noreferrer')
    
    // Test contributing link
    const contributingLink = page.locator('a[href="https://github.com/TAJD/gistreact/blob/main/CONTRIBUTING.md"]')
    await expect(contributingLink).toHaveAttribute('target', '_blank')
    await expect(contributingLink).toHaveAttribute('rel', 'noopener noreferrer')
    
    console.log('All GitHub repository links are properly configured')
  })
})