# Bug Analysis: Scan Stuck in PENDING Status

## Root Cause Analysis

### Investigation Summary
Investigated why scan `8fb219cf-d1f0-4974-8c3e-1ff050f665cc` remains in PENDING status indefinitely at `http://localhost:3000/scan/8fb219cf-d1f0-4974-8c3e-1ff050f665cc`.

**Investigation Steps:**
1. Traced the scan processing flow from API → Database → Queue → Worker
2. Verified infrastructure services (Redis, PostgreSQL, MinIO) are running
3. Checked for worker process - **NOT FOUND**
4. Confirmed jobs are being added to BullMQ queue but never consumed

### Root Cause
**The Worker application is NOT running.**

The system architecture requires three applications to be running:
1. ✅ API (`apps/api`) - Running on port 3080
2. ✅ Web (`apps/web`) - Running on port 3000
3. ❌ **Worker (`apps/worker`) - NOT RUNNING**

When a scan is submitted:
1. API creates scan record with status `PENDING`
2. API adds job to BullMQ `scan-page` queue in Redis
3. **Worker should pick up the job and process it** ← This step never happens
4. Worker should update status to `RUNNING` → `COMPLETED`/`FAILED`

Since the Worker is not running, jobs sit in the queue forever and scans remain `PENDING`.

### Contributing Factors
1. No startup script or documentation indicating worker needs to be started separately
2. Docker Compose only starts infrastructure (postgres, redis, minio), not application services
3. No health check or monitoring to detect missing worker

## Technical Details

### Affected Code Locations

- **File**: `apps/worker/src/index.ts`
  - **Role**: Worker entry point - creates BullMQ workers
  - **Issue**: This file is never executed because worker app isn't started

- **File**: `apps/worker/src/processors/scan-page.processor.ts`
  - **Role**: Processes scan jobs from queue
  - **Lines**: 30-80 (main processing logic)
  - **Issue**: Never invoked because worker isn't running

- **File**: `apps/api/src/modules/scan/scan.service.ts`
  - **Role**: Creates scan and queues job
  - **Issue**: Jobs are queued successfully but never consumed

### Data Flow Analysis

```
User Request → API (port 3080)
                    ↓
              PostgreSQL (scan record: PENDING)
                    ↓
              Redis/BullMQ (job added to 'scan-page' queue)
                    ↓
              ❌ Worker (NOT RUNNING - jobs never consumed)
                    ↓
              ❌ Status never updated
                    ↓
              Frontend shows PENDING forever
```

### Dependencies
- **BullMQ**: Queue system (working - Redis is running on port 56379)
- **Redis**: Queue storage (working - container `adashield-redis` running)
- **PostgreSQL**: Data storage (working - container `adashield-postgres` running)

## Impact Analysis

### Direct Impact
- All scans submitted will remain in PENDING status forever
- Users cannot get accessibility scan results
- Core product functionality is completely broken

### Indirect Impact
- Poor user experience - no feedback that system isn't working
- Potential queue buildup in Redis as jobs accumulate
- Admin dashboard shows all scans as PENDING

### Risk Assessment
- **Severity**: Critical - Core feature completely non-functional
- **Affected Users**: 100% of users attempting to scan
- **Business Impact**: Product cannot deliver its primary value

## Solution Approach

### Fix Strategy
Start the Worker application alongside API and Web applications.

**Immediate Fix:**
```bash
cd apps/worker && pnpm dev
```

**Long-term Fix:**
Add worker to startup scripts and documentation.

### Alternative Solutions
1. **Combined process**: Run worker in same process as API (not recommended - blocks request handling)
2. **Docker Compose**: Add worker service to docker-compose.dev.yml (viable for consistent dev environment)
3. **PM2/Process Manager**: Use PM2 to manage all three apps (good for production-like dev)

### Risks and Trade-offs
- **Chosen approach**: Simple and immediate, requires manual start
- **Docker approach**: More setup but consistent, may slow development iteration
- **PM2 approach**: Best for production readiness but adds complexity

## Implementation Plan

### Changes Required

1. **Immediate: Start Worker**
   - Command: `cd apps/worker && pnpm dev`
   - Effect: Worker will start consuming queued jobs

2. **Optional: Update startup script**
   - File: `app-start.sh` (if exists)
   - Add worker startup command

3. **Optional: Add to docker-compose.dev.yml**
   - Add worker service definition
   - Ensures all services start together

### Testing Strategy
1. Start the worker application
2. Verify worker logs show connection to Redis
3. Check existing PENDING scans - they should start processing
4. Submit a new scan and verify it progresses from PENDING → RUNNING → COMPLETED
5. Verify scan results are displayed on the frontend

### Rollback Plan
If worker causes issues:
1. Stop worker process (`Ctrl+C` or `pkill -f "worker"`)
2. Scans will queue again but won't cause errors
3. Investigate worker logs for issues
