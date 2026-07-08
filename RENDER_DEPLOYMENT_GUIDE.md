# Render Deployment Verification Guide

## Quick Status Check

**Live URL:** https://voiceos-app.onrender.com/qa-center

## How to Check Render Deployment Status

### Method 1: Render Dashboard

1. Go to https://dashboard.render.com
2. Click on the **voiceos-app** service
3. Look at the top right corner:
   - 🟢 **Live** = Service deployed and running
   - 🟡 **Deploying** = Currently building/deploying
   - 🔴 **Failed** = Deployment failed

### Method 2: Deployment Log

1. In Render Dashboard → voiceos-app service
2. Click **Logs** tab
3. View live build/deployment output
4. **Success message:** "Build successful" + "Your service is live"
5. **Error message:** Shows "Error building" with details

### Method 3: Direct Browser Test

1. Open browser to https://voiceos-app.onrender.com/qa-center
2. **Expected response:**
   - ✅ Page loads completely (no 404 or error page)
   - ✅ 3-panel layout visible
   - ✅ Data loads within 2 seconds
3. **If 404:** Build hasn't deployed yet, or deployment failed
4. **If blank/error:** Build succeeded but runtime error

## What Happens After Git Push

**Timeline (typical):**

- **0 sec:** You push to GitHub
- **0-30 sec:** GitHub sends webhook to Render
- **30-60 sec:** Render detects change, starts build
- **1-5 min:** npm install + TypeScript compilation + Next.js build
- **5-7 min:** Build completes, Render redeploys service
- **7-10 min:** Service fully live (cold start)

**Total:** Usually 7-10 minutes from push to live

## Expected Build Steps

When you view Render logs, you should see:

```
Building... (Starting build process)
npm install --legacy-peer-deps
Building with Next.js...
next build
Compiled successfully ✓
Starting service...
Service is live!
```

## Common Deployment Issues

### Issue 1: "Module not found" Error

**Cause:** Dependencies not installed
**Solution:** Push again, Render will retry `npm install`

### Issue 2: "SWC Error" in Logs

**Cause:** Build failed due to Windows binary in repository
**Solution:** This error should NOT happen on Render (Linux). If it does, clear Render cache:

1. Render Dashboard → Settings
2. Clear build cache
3. Redeploy

### Issue 3: "Port already in use"

**Cause:** Previous build didn't shut down properly
**Solution:** Render handles this automatically, but you can manually redeploy

### Issue 4: Build Hangs or Times Out

**Cause:** Dependencies taking too long to install
**Solution:** Render has 30-minute timeout. If it hangs:

1. Wait for timeout
2. Push empty commit: `git commit --allow-empty -m "trigger rebuild"`
3. Push again

## Check GitHub Integration

1. Go to https://github.com/your-username/your-repo
2. Click **Settings** tab
3. Click **Webhooks**
4. Should see **render.com** webhook
5. Click it → see recent deliveries (should be green ✅)

If no Render webhook exists:

1. Go to Render Dashboard
2. voiceos-app service
3. Settings → GitHub Connection
4. Click "Reconnect" or "Sync"

## Verify Deployment was Triggered

After you `git push voiceos-saas-build`:

1. **Check GitHub Actions** (if you have any):

   - GitHub repo → Actions tab
   - Should show push event triggered

2. **Check Render Logs**:

   - Render Dashboard → voiceos-app → Logs
   - Should show build starting within 60 seconds of your push

3. **Check Git Commit History**:
   - GitHub repo → Code → Commits
   - Your commit should appear
   - Render webhook should have delivered

## Render Service Environment

Your deployed service is running:

- **Platform:** Linux (Ubuntu)
- **Runtime:** Node.js
- **Database:** Supabase (remote)
- **Build:** npm install --legacy-peer-deps → npm run build
- **Start:** npm run start

This means:

- ✅ No Windows binary issues (uses Linux binaries)
- ✅ Full SWC support (Linux compiler works)
- ✅ If it builds locally on Linux, it builds on Render

## Supabase Connection Check

To verify Supabase is connected correctly on Render:

1. Render Dashboard → voiceos-app → Environment
2. Check that these env vars exist:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. Test connection:
   - Go to https://voiceos-app.onrender.com/qa-center
   - Open DevTools → Network tab
   - Should see `GET /api/calls` → Status 200
   - Response should have `calls: [...]` array

## Success Checklist

- [ ] Git push completed without errors
- [ ] Render Dashboard shows status as 🟢 **Live**
- [ ] Render Logs show "Service is live!"
- [ ] Browser loads https://voiceos-app.onrender.com/qa-center (no 404)
- [ ] Page shows 3-panel layout (left | center | right)
- [ ] Calls list loads with data
- [ ] Clicking a call updates all 3 panels
- [ ] Browser console has no errors (F12 → Console)
- [ ] Network tab shows `/api/calls` returning 200 with data

## If Deployment Failed

**Step 1:** Check Render Logs for errors

```
Render Dashboard → voiceos-app → Logs
Look for red error messages
```

**Step 2:** Check GitHub commit

```
GitHub → Code → Commits
Verify commit 928abd4 (feat(qac-v2)...) is there
```

**Step 3:** Check Render git sync

```
Render Dashboard → Settings → GitHub
Click "Resync repository"
```

**Step 4:** Force Redeploy

```
Render Dashboard → Manual Deploy
Click "Deploy latest commit"
```

**Step 5:** Report the Issue
If still failing, check these files in Render Logs:

- Look for TypeScript errors
- Look for missing imports
- Look for database connection errors
- Note exact error message and share

## After Verification

Once you confirm:
✅ https://voiceos-app.onrender.com/qa-center loads successfully
✅ 3-panel layout visible
✅ Calls load and can be clicked
✅ No console errors

Then Phase 2 deployment is complete! ✨

Next steps:

- Test UI functionality more thoroughly
- Collect feedback on design
- Plan Phase 3 features (if any)
