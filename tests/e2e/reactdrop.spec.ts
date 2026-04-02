import { test, expect } from '@playwright/test'

test.describe('ReactDrop E2E Tests', () => {
  test('Landing page loads with ReactDrop branding and key sections visible', async ({ page }) => {
    await page.goto('/')

    // Check for ReactDrop branding
    await expect(page.locator('h1')).toContainText('ReactDrop')
    await expect(page.locator('img[alt="ReactDrop"]')).toBeVisible()

    // Check for hero section
    await expect(page.locator('.hero-description')).toContainText('Host and share React components directly from GitHub Gists')

    // Check for key feature sections
    await expect(page.locator('.hero-features')).toBeVisible()
    await expect(page.locator('h3')).toContainText('🚀 Instant Hosting')
    await expect(page.locator('h3')).toContainText('🔗 No CORS Issues')
    await expect(page.locator('h3')).toContainText('📊 Analytics')

    // Check for "How it works" section
    await expect(page.locator('text=How it works')).toBeVisible()

    // Check for main content
    await expect(page.locator('main.main-content')).toBeVisible()
  })

  test('"Validate Your Component" CTA navigates to /validate', async ({ page }) => {
    await page.goto('/')

    // Find and click the validate button
    const validateBtn = page.locator('button.validate-btn')
    await expect(validateBtn).toBeVisible()
    await expect(validateBtn).toContainText('Validate Your Component')

    await validateBtn.click()

    // Should navigate to /validate
    await expect(page).toHaveURL('/validate')
  })

  test('Validator: load example shows code in textarea', async ({ page }) => {
    await page.goto('/validate')

    // Wait for validator page to load
    await expect(page.locator('h1')).toContainText('Component Validator')

    // Find and click the "Load example" button
    const exampleBtn = page.locator('button.example-btn')
    await expect(exampleBtn).toBeVisible()
    await exampleBtn.click()

    // Check that code is loaded in textarea
    const textarea = page.locator('textarea#code-editor')
    const codeValue = await textarea.inputValue()

    expect(codeValue).toBeTruthy()
    expect(codeValue).toContain('Counter')
    expect(codeValue).toContain('useState')
    expect(codeValue).toContain('export default')
  })

  test('Validator: valid code shows all green checks', async ({ page }) => {
    await page.goto('/validate')

    // Load the example code
    await page.locator('button.example-btn').click()

    // Wait for validation to run (debounced)
    await page.waitForTimeout(500)

    // Check validation section appears
    await expect(page.locator('.validation-section')).toBeVisible()

    // Verify all checks pass (green checkmarks)
    const checkItems = page.locator('.check-item.pass')
    const passCount = await checkItems.count()
    expect(passCount).toBeGreaterThan(0)

    // Verify no fail checks
    const failItems = page.locator('.check-item.fail')
    const failCount = await failItems.count()
    expect(failCount).toBe(0)

    // Check for "Component is deployable" message
    await expect(page.locator('.summary-pass')).toContainText('Component is deployable on ReactDrop')
  })

  test('Validator: invalid code shows failures', async ({ page }) => {
    await page.goto('/validate')

    // Enter code with no component (invalid)
    const textarea = page.locator('textarea#code-editor')
    await textarea.fill('const x = 42;')

    // Wait for validation
    await page.waitForTimeout(500)

    // Check validation section appears
    await expect(page.locator('.validation-section')).toBeVisible()

    // Should have fail checks
    const failItems = page.locator('.check-item.fail')
    const failCount = await failItems.count()
    expect(failCount).toBeGreaterThan(0)

    // Check for "Fix the issues" message
    await expect(page.locator('.summary-fail')).toContainText('Fix the issues above before deploying')
  })

  test('Validator: forbidden import (fs) is caught', async ({ page }) => {
    await page.goto('/validate')

    // Enter code with forbidden import
    const textarea = page.locator('textarea#code-editor')
    const forbiddenCode = `import fs from 'fs'

export default function App() {
  return <div>Component</div>
}`

    await textarea.fill(forbiddenCode)

    // Wait for validation
    await page.waitForTimeout(500)

    // Check for validation section
    await expect(page.locator('.validation-section')).toBeVisible()

    // Look for forbidden imports check with fail status
    const forbiddenCheck = page.locator('.check-item.fail')
    await expect(forbiddenCheck).toContainText('Forbidden imports')
    await expect(forbiddenCheck).toContainText('fs')

    // Component should not be deployable
    await expect(page.locator('.summary-fail')).toBeVisible()
  })

  test('Home button navigates back to landing page', async ({ page }) => {
    await page.goto('/validate')

    // Find and click home button
    const homeBtn = page.locator('button.home-btn')
    await expect(homeBtn).toBeVisible()
    await expect(homeBtn).toContainText('← Home')

    await homeBtn.click()

    // Should navigate back to landing page
    await expect(page).toHaveURL('/')

    // Verify landing page content
    await expect(page.locator('h1')).toContainText('ReactDrop')
  })

  test('/validate route loads directly (not just from landing)', async ({ page }) => {
    // Navigate directly to /validate without going through landing
    await page.goto('/validate')

    // Verify validator page loads correctly
    await expect(page.locator('h1')).toContainText('Component Validator')
    await expect(page.locator('.validator-page')).toBeVisible()

    // Verify key validator elements are present
    await expect(page.locator('textarea#code-editor')).toBeVisible()
    await expect(page.locator('button.example-btn')).toBeVisible()
    await expect(page.locator('button.home-btn')).toBeVisible()
  })

  test('Validator textarea accepts user input', async ({ page }) => {
    await page.goto('/validate')

    const textarea = page.locator('textarea#code-editor')
    const testCode = 'export default function MyComponent() { return <div>Test</div> }'

    await textarea.fill(testCode)

    // Verify input was accepted
    const inputValue = await textarea.inputValue()
    expect(inputValue).toBe(testCode)
  })

  test('Navigation between landing and validator maintains state', async ({ page }) => {
    // Start at landing
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('ReactDrop')

    // Navigate to validator
    await page.locator('button.validate-btn').click()
    await expect(page).toHaveURL('/validate')

    // Load example
    await page.locator('button.example-btn').click()
    await page.waitForTimeout(500)

    // Verify code is loaded
    const textarea = page.locator('textarea#code-editor')
    let codeValue = await textarea.inputValue()
    expect(codeValue).toContain('Counter')

    // Navigate back home
    await page.locator('button.home-btn').click()
    await expect(page).toHaveURL('/')

    // Navigate back to validator
    await page.locator('button.validate-btn').click()
    await expect(page).toHaveURL('/validate')

    // Textarea should be empty again (fresh page)
    codeValue = await textarea.inputValue()
    expect(codeValue).toBe('')
  })

  test('Validator shows validation results in real-time', async ({ page }) => {
    await page.goto('/validate')

    const textarea = page.locator('textarea#code-editor')

    // Initially no validation section
    await expect(page.locator('.validation-section')).not.toBeVisible()

    // Type valid code
    const validCode = `export default function Button() {
  return <button>Click me</button>
}`

    await textarea.fill(validCode)

    // Wait for debounced validation
    await page.waitForTimeout(500)

    // Now validation section should appear
    await expect(page.locator('.validation-section')).toBeVisible()
    await expect(page.locator('.check-item')).toBeTruthy()
  })

  test('Validator checks all five validation rules', async ({ page }) => {
    await page.goto('/validate')

    // Load valid example
    await page.locator('button.example-btn').click()
    await page.waitForTimeout(500)

    // Check for all five validation check types
    await expect(page.locator('[data-testid="check-size"], .check-item')).toBeTruthy()

    // Get all check items
    const checkItems = page.locator('.check-item')
    const count = await checkItems.count()

    // Should have 5 checks: size, component, export, forbidden, allowlist
    expect(count).toBeGreaterThanOrEqual(5)

    // Verify we can see check labels for each check
    await expect(page.locator('text=Code size')).toBeVisible()
    await expect(page.locator('text=React component')).toBeVisible()
    await expect(page.locator('text=Default export')).toBeVisible()
    await expect(page.locator('text=Forbidden imports')).toBeVisible()
    await expect(page.locator('text=Supported libraries')).toBeVisible()
  })

  test('Invalid component (no export) shows warning about auto-export', async ({ page }) => {
    await page.goto('/validate')

    const textarea = page.locator('textarea#code-editor')
    const noExportCode = `function MyButton() {
  return <button>Click me</button>
}`

    await textarea.fill(noExportCode)
    await page.waitForTimeout(500)

    // Should show validation with warning about auto-export
    await expect(page.locator('.validation-section')).toBeVisible()
    await expect(page.locator('.check-item')).toContainText('auto-add')
  })

  test('Landing page has footer with contact info', async ({ page }) => {
    await page.goto('/')

    // Check footer is visible
    await expect(page.locator('footer')).toBeVisible()

    // Check for contact email
    await expect(page.locator('a[href*="tom@verdient"]')).toBeVisible()
  })

  test('Validator has home button visible at all times', async ({ page }) => {
    await page.goto('/validate')

    // Home button should be visible
    const homeBtn = page.locator('button.home-btn')
    await expect(homeBtn).toBeVisible()

    // Load example
    await page.locator('button.example-btn').click()
    await page.waitForTimeout(500)

    // Home button should still be visible
    await expect(homeBtn).toBeVisible()
  })
})
