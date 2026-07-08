# QA Center v2 - Phase 1 Deployment Guide

## Overview
Phase 1 introduces the data layer for the new QA Center with:
- Customer journey tracking
- Department-specific QA configuration
- Rule-based violation detection
- Alert management with Telegram integration
- Transcript segmentation with timestamps
- Role-based access control (RBAC)

## Commits
- **7827c74**: Phase 1 migrations (SQL)
- **5c3496c**: Types and scoring helpers

## Prerequisites

### 1. Supabase Credentials
You need the following environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Get these from:
1. Go to Supabase dashboard
2. Select your project
3. Settings → API → Copy URL and Service Role Key

### 2. Database Setup (One-time)
The migrations will create the following tables:

```
qa_customer_journeys        # Customer journey tracking
qa_journey_calls            # Call sequence in journey
qa_departments              # QA config per department
qa_forbidden_rules          # Violation detection rules
qa_alerts                   # Alert management
qa_transcript_segments      # Transcript with timestamps
qa_call_transcript_summary  # Cached transcript stats
qa_roles                    # RBAC roles
qa_user_roles               # User role assignments
```

Plus supporting tables:
- `qa_department_audit`
- `qa_forbidden_rules_versions`
- `qa_alerts_audit`
- `qa_alerts_telegram_queue`

## Deployment

### Option 1: Local Testing
```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Run migrations
npx ts-node scripts/run-migrations.ts

# Verify build
npm run build
npm run lint
```

### Option 2: Render Deployment
1. Add environment variables to Render dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Add migration command to `start.sh`:
```bash
#!/bin/bash
npx ts-node scripts/run-migrations.ts
npm run build
npm start
```

3. Deploy:
```bash
git push origin voiceos-saas-build
# Render will auto-deploy
```

## Verification

### 1. Check tables exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'qa_%';
```

### 2. Check default roles
```sql
SELECT * FROM qa_roles WHERE is_system = true;
```

Expected output:
- Owner/Admin (all permissions)
- QA Manager (manage rules + departments)
- Supervisor (view team calls + acknowledge alerts)
- Agent (view own calls)
- Viewer (read-only)

### 3. Test journey creation
```typescript
// In your code
import { findOrCreateJourney } from "@/lib/qa/journey";

const journey = await findOrCreateJourney(
  "workspace-id",
  "+1 809 555-1234",
  "John Doe",
  "agent-id",
  "conversión"
);
```

## What's Next

### Phase 2: UI Reconstruction
- [ ] Dashboard main layout (3-column)
- [ ] Call list with filters
- [ ] Audio player + transcript viewer
- [ ] Score card
- [ ] Journey context panel

### Phase 3: Analysis Engine
- [ ] Department-specific scoring
- [ ] Forbidden rule detection
- [ ] Alert generation
- [ ] Telegram notifications

### Phase 4: Settings
- [ ] Department management
- [ ] Rule configuration
- [ ] Role management
- [ ] Alert center

## Troubleshooting

### Error: "No connection to Supabase"
```bash
# Verify credentials
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
curl https://xxxxx.supabase.co/rest/v1/
  -H "apikey: SERVICE_ROLE_KEY"
```

### Error: "Type mismatch in migration"
- Check PostgreSQL version in Supabase (should be 14+)
- Verify enum types (qa_permission, qa_role_type)
- Check vector extension is enabled: `CREATE EXTENSION IF NOT EXISTS vector;`

### Build fails with TypeScript errors
```bash
npm run build -- --verbose
# Check error line numbers in lib/supabase/types.ts
```

## Deployment Checklist

- [ ] Environment variables set in Render
- [ ] Database migrations applied
- [ ] Build passes without TypeScript errors
- [ ] Lint passes
- [ ] Tables verified in Supabase dashboard
- [ ] Default roles created
- [ ] Commit hash noted (for rollback if needed)

## Rollback

If migrations fail:
1. Check last working commit
2. Contact Supabase support for table deletion
3. Revert commits and redeploy

---

## Contact

For issues or questions:
- Check console logs in Render dashboard
- Review Supabase Activity tab for errors
- Reference specific migration file (076-081)
