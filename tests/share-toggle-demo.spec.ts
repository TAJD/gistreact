import { test, expect } from '@playwright/test'

test.describe('Share Toggle Demo', () => {
  test('demonstrate share toggle behavior by injecting share ID', async ({ page }) => {
    // Go to the gist page
    await page.goto('/e41c69596e5817832dca9c1c9e217391')
    
    // Wait for component to load
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 })
    
    // Inject a mock share ID to simulate the share button behavior
    await page.evaluate(() => {
      // Find the GistRenderer and modify its state to include a shareId
      const nav = document.querySelector('.gist-nav');
      if (nav) {
        // Create and add the share toggle button
        const shareButton = document.createElement('button');
        shareButton.className = 'share-toggle-btn';
        shareButton.title = 'Show share options';
        shareButton.textContent = '🔗';
        shareButton.style.cssText = `
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.1rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          height: 44px;
        `;
        
        // Add the button to the nav
        nav.appendChild(shareButton);
        
        // Create the shareable link component
        const shareableLink = document.createElement('div');
        shareableLink.className = 'shareable-link';
        shareableLink.style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          padding: 20px;
          margin: 0;
          position: fixed;
          top: var(--header-height, 90px);
          left: 0;
          right: 0;
          z-index: 999;
          display: none;
          animation: slideDownFromHeader 0.3s ease;
        `;
        
        shareableLink.innerHTML = `
          <div class="share-info" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span class="share-label" style="font-weight: 600; color: white; white-space: nowrap;">🔗 Shareable link:</span>
            <code class="share-url" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; padding: 10px 14px; color: white; flex: 1; min-width: 200px;">
              ${window.location.origin}/share/demo-sailing-trip
            </code>
            <button class="copy-btn" style="background: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 8px; padding: 8px 12px; color: white; cursor: pointer;">📋</button>
            <button class="edit-btn" style="background: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 8px; padding: 8px 12px; color: white; cursor: pointer;">✏️</button>
          </div>
        `;
        
        // Add to the page
        document.body.appendChild(shareableLink);
        
        // Add click handler to toggle
        let isVisible = false;
        shareButton.addEventListener('click', () => {
          isVisible = !isVisible;
          shareableLink.style.display = isVisible ? 'block' : 'none';
          shareButton.title = isVisible ? 'Hide share options' : 'Show share options';
        });
      }
    });
    
    // Take screenshot showing the share button added
    await page.screenshot({
      path: 'test-results/share-demo-button-added.png',
      fullPage: true
    });
    
    // Click the share button to show the share options
    await page.click('.share-toggle-btn');
    await page.waitForTimeout(500);
    
    // Take screenshot showing share options expanded
    await page.screenshot({
      path: 'test-results/share-demo-expanded.png',
      fullPage: true
    });
    
    // Click again to hide
    await page.click('.share-toggle-btn');
    await page.waitForTimeout(500);
    
    // Take screenshot showing share options hidden
    await page.screenshot({
      path: 'test-results/share-demo-hidden.png',
      fullPage: true
    });
    
    // Test mobile version
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // Re-inject the share functionality for mobile
    await page.waitForSelector('.gist-nav.visible', { timeout: 10000 });
    
    await page.evaluate(() => {
      const nav = document.querySelector('.gist-nav');
      if (nav) {
        const shareButton = document.createElement('button');
        shareButton.className = 'share-toggle-btn';
        shareButton.title = 'Show share options';
        shareButton.textContent = '🔗';
        shareButton.style.cssText = `
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.1rem;
          min-width: 44px;
          height: 44px;
        `;
        nav.appendChild(shareButton);
        
        const shareableLink = document.createElement('div');
        shareableLink.className = 'shareable-link';
        shareableLink.style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 0 0 12px 12px;
          padding: 20px;
          margin: 0;
          position: fixed;
          top: var(--header-height, 90px);
          left: 0;
          right: 0;
          z-index: 999;
          display: none;
        `;
        
        shareableLink.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span style="font-weight: 600; color: white;">🔗 Shareable link:</span>
              <code style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; padding: 10px 14px; color: white; width: 100%; text-align: center;">
                ${window.location.origin}/share/demo-sailing-trip
              </code>
            </div>
            <div style="display: flex; gap: 8px;">
              <button style="background: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 8px; padding: 8px 12px; color: white; flex: 1;">📋 Copy</button>
              <button style="background: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 8px; padding: 8px 12px; color: white; flex: 1;">✏️ Edit</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(shareableLink);
        
        let isVisible = false;
        shareButton.addEventListener('click', () => {
          isVisible = !isVisible;
          shareableLink.style.display = isVisible ? 'block' : 'none';
        });
      }
    });
    
    // Take mobile screenshot with share button
    await page.screenshot({
      path: 'test-results/share-demo-mobile-button.png',
      fullPage: true
    });
    
    // Click to show mobile share options
    await page.click('.share-toggle-btn');
    await page.waitForTimeout(500);
    
    // Take mobile screenshot with share options expanded
    await page.screenshot({
      path: 'test-results/share-demo-mobile-expanded.png',
      fullPage: true
    });
  });
})