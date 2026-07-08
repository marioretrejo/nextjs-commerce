# Phase 2 UI Verification Checklist

## What You Should See at https://voiceos-app.onrender.com/qa-center

### Layout Structure

- [ ] Page has 3 distinct columns (left | center | right)
- [ ] Left column: ~380px width, white background, scrollable
- [ ] Center column: flexible width, white background, scrollable
- [ ] Right column: ~384px width, gray background (#F3F4F6), scrollable

### Left Panel: Calls List

- [ ] Header: "Recent Calls (50)" with refresh button
- [ ] Search input with placeholder "Search calls..."
- [ ] List of calls with:
  - [ ] Avatar/initials (or colored circle)
  - [ ] Client name (bold, black text)
  - [ ] Department (small text, gray)
  - [ ] Score badge (colored circle: green/yellow/red)
  - [ ] Phone number (small, gray)
  - [ ] Duration (MM:SS format)
  - [ ] Date (relative: "2 hours ago")
  - [ ] Status badge ("Analyzed", "Processing", "Pending")
- [ ] Clicking a call highlights it (border changes)

### Center Panel: Call Player & Transcript

- [ ] Header section with:
  - [ ] Client name (large, black)
  - [ ] Agent name and phone (small, gray)
- [ ] Audio Player:
  - [ ] Play/Pause button
  - [ ] Timeline bar (gray, clickable)
  - [ ] Time display (00:00 - 06:24 format)
  - [ ] Speed selector (1x, 1.25x, 1.5x, 2x)
  - [ ] Download button (if recording_url exists)
- [ ] Transcript section:
  - [ ] Search input ("Search in transcript...")
  - [ ] Transcript content displayed
  - [ ] Agent and Customer labels
  - [ ] Readable formatting with proper spacing

### Right Panel: Score Card

- [ ] Heading: "QA Score"
- [ ] Circular progress gauge:
  - [ ] Large score number (87, 92, etc.)
  - [ ] "/100" below score
  - [ ] Green circle for high scores (80+)
  - [ ] Yellow circle for medium scores (60-80)
  - [ ] Red circle for low scores (<60)
- [ ] Risk badge ("Low Risk", "Medium Risk", "High Risk")
- [ ] Sentiment indicator (emoji + text)
- [ ] "Score Breakdown" section with:
  - [ ] 5 categories: Opening, Discovery, Objection Handling, Compliance, Closing
  - [ ] Score for each (/100)
  - [ ] Progress bar for each
- [ ] "Strengths" section (green checkmark icon, bullet list)
- [ ] "Opportunities" section (yellow alert icon, bullet list)
- [ ] "Recommendations" section (trending up icon, paragraph text)
- [ ] "View Coaching Plan" button at bottom

## Color Scheme

- [ ] White background: #FFFFFF
- [ ] Black text: #000000
- [ ] Gray borders: #E5E7EB
- [ ] Green (80+ score): #10B981
- [ ] Yellow (60-80 score): #F59E0B
- [ ] Red (<60 score): #EF4444
- [ ] Gray background (right panel): #F3F4F6

## Interactivity

- [ ] Click a call in left panel → center panel updates
- [ ] Click a call in left panel → right panel updates
- [ ] Search box filters calls
- [ ] Refresh button loads new data
- [ ] Play/Pause button responds (visually, even if audio doesn't work yet)
- [ ] Speed selector is interactive
- [ ] Download button (if available)

## Data Loading

- [ ] Initially shows loading skeletons (gray boxes)
- [ ] After ~1-2 seconds, data loads
- [ ] If no calls exist: "No calls found" message in center
- [ ] If no call selected: placeholder in center ("🎙️ No call selected")

## Responsive Design

- [ ] 3 columns are visible on desktop (1280+ width)
- [ ] Columns stack on tablet/mobile (optional for now)
- [ ] No horizontal scrolling on page body
- [ ] Individual panels scroll vertically

## Browser Console

- [ ] No JavaScript errors (F12 → Console tab)
- [ ] No TypeScript warnings
- [ ] Network requests are successful (F12 → Network tab)
  - [ ] `/api/calls` returns 200 status
  - [ ] Response has `calls` array

## Testing Steps

### Test 1: Page Load

1. Go to https://voiceos-app.onrender.com/qa-center
2. Verify: Page loads (no 404, no error)
3. Verify: 3-panel layout visible
4. Verify: Loading skeletons appear briefly
5. Verify: Data loads after ~2 seconds

### Test 2: Call Selection

1. Click first call in left panel
2. Verify: Call gets selected (border highlights)
3. Verify: Center panel updates with call details
4. Verify: Right panel updates with score
5. Verify: All 3 panels show matching data

### Test 3: Search

1. Type in search box (client name, phone, agent)
2. Verify: Calls list filters
3. Verify: Results update in real time

### Test 4: Visual Verification

1. Check colors match spec above
2. Check fonts are readable (no size issues)
3. Check spacing/padding looks clean
4. Check no overlapping text
5. Check score badges are colored correctly

## If Something's Wrong

**Page shows 404:**

- [ ] Check Render deployed successfully (Dashboard)
- [ ] Check git branch is correct (voiceos-saas-build)
- [ ] Check /qa-center route exists

**Page loads but looks blank/broken:**

- [ ] Press F12 to open DevTools
- [ ] Check Console tab for errors
- [ ] Check Network tab for failed requests
- [ ] Take screenshot and share

**Data doesn't load:**

- [ ] Check Network tab for `/api/calls` response
- [ ] Verify Supabase has data
- [ ] Check for CORS errors
- [ ] Check browser console logs

**Components don't match this checklist:**

- [ ] Run clean build locally: `rm -rf node_modules && npm install --legacy-peer-deps && npm run build`
- [ ] Check for TypeScript errors: `npm exec tsc -- --noEmit`
- [ ] Restart Render deployment

## Success Criteria

✅ All 3 panels visible and working
✅ Calls load and can be selected
✅ Colors match the spec
✅ No console errors
✅ Responsive layout looks clean
