# Manual Test for Header Hiding Functionality

## Test Steps

1. **Start the development server**
   ```bash
   pnpm dev 
   ```

2. **Navigate to the application**
   Open http://localhost:5173 in your browser

3. **Create a test component**
   Enter a GitHub Gist URL or use a known working gist ID

4. **Test Header Hiding**
   - The header should be visible initially with classes `gist-nav visible`
   - Scroll down more than 100px - the header should hide with classes `gist-nav hidden`
   - Scroll back up - the header should show with classes `gist-nav visible`

5. **Test CSS Transitions**
   - Check that the header slides smoothly up/down when hiding/showing
   - The transition should use `transform: translateY()` animation

6. **Test Home Button**
   - Click the "← Home" button in the header
   - Should navigate back to the landing page

## Expected Results

- Header visibility changes smoothly based on scroll direction
- Header has `visible` class when shown, `hidden` class when hidden
- CSS transitions work properly
- Home button navigation works
- Component content is not obscured by fixed header

## CSS Classes to Check

- `.gist-nav.visible` - Header shown
- `.gist-nav.hidden` - Header hidden (translated up)
- Fixed positioning and z-index working correctly