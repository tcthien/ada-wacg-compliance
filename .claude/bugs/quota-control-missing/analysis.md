# Bug Analysis: Missing Quota Control for Batch Scan and AI Scan

## Status
**ANALYZED** - Ready for implementation

## Root Cause Analysis

### Investigation Summary

Conducted thorough code review of:
1. `batch.schema.ts` - Validation schema allows 50 URLs
2. `batch.service.ts` - Hardcoded 50 URL limit, no AI URL count validation
3. `rate-limit.ts` - Hourly limits (100 URLs/hour, 2 batches/hour), not per-request
4. `ai-campaign.service.ts` - Campaign-based token limits, no per-user daily limit
5. `ScanForm.tsx` - No client-side URL count enforcement
6. `redis-keys.ts` - No key for AI daily quota tracking

### Root Cause

The system was designed for higher usage limits without implementing the free tier quota controls required for:
1. Resource cost management (AI costs $0.10-0.20/page)
2. Abuse prevention
3. Lead generation (encourage paid upgrades)

### Contributing Factors

1. **Early development focus**: Initial implementation prioritized functionality over quotas
2. **No subscription system**: Without user tiers, quotas weren't a priority
3. **Campaign-based AI limits**: AI limits tied to global campaign budget, not per-user

## Technical Details

### Affected Code Locations

| File | Location | Issue |
|------|----------|-------|
| `apps/api/src/modules/batches/batch.schema.ts` | Line 80 | `.max(50, ...)` - Too high |
| `apps/api/src/modules/batches/batch.service.ts` | Lines 130-134 | Hardcoded `> 50` check |
| `apps/api/src/modules/batches/batch.service.ts` | Lines 195-246 | AI per-URL reservation, no batch limit |
| `apps/api/src/shared/middleware/rate-limit.ts` | Lines 38-45 | Hourly limits, not per-request |
| `apps/api/src/shared/constants/redis-keys.ts` | N/A | Missing AI daily quota key |
| `apps/web/src/components/features/scan/ScanForm.tsx` | N/A | No URL count enforcement |

### Data Flow Analysis

```
[Frontend ScanForm]
    │ No URL limit check
    ▼
[POST /api/v1/batch]
    │ Schema validates: max 50 URLs (too high)
    ▼
[batch.service.ts - createBatch()]
    │ Hardcoded check: > 50 (too high)
    │ AI loop: reserves slot per URL (no batch limit)
    │ No daily AI limit check
    ▼
[ai-campaign.service.ts - checkAndReserveSlotAtomic()]
    │ Campaign-based only, no per-user tracking
    ▼
[Scans created] - No quotas enforced!
```

### Dependencies

- Redis: Already used for rate limiting, can extend for quota tracking
- Prisma: No schema changes needed
- Frontend: Needs UI updates to show quota limits

## Impact Analysis

### Direct Impact
- Users can create batches with 50 URLs (should be 5)
- AI enabled for unlimited URLs per batch
- No daily AI usage cap per user

### Indirect Impact
- AI costs could exceed budget ($0.10-0.20 × unlimited URLs)
- No incentive to upgrade to paid plans
- Potential for abuse by automated tools

### Risk Assessment
- **Cost Risk**: HIGH - Uncontrolled AI usage
- **Abuse Risk**: MEDIUM - No per-user limits
- **Business Risk**: HIGH - No upsell pressure for free tier

## Solution Approach

### Fix Strategy

Implement **layered quota enforcement**:

1. **Layer 1: Schema Validation** - Reject requests exceeding URL limits
2. **Layer 2: Service Validation** - Check AI batch limits and daily caps
3. **Layer 3: Frontend Validation** - Show limits and prevent submission
4. **Layer 4: Redis Tracking** - Track daily AI usage per session

### Alternative Solutions

| Approach | Pros | Cons |
|----------|------|------|
| **Schema-only** | Simple | No AI-specific limits |
| **Middleware** | Centralized | Complex, affects all endpoints |
| **Service-level** | Granular control | More code changes |
| **Database tracking** | Persistent | Overkill for free tier |

**Chosen**: Service-level with Redis tracking (best balance)

### Risks and Trade-offs

| Risk | Mitigation |
|------|------------|
| Breaking existing workflows | Clear error messages with upgrade path |
| Redis dependency | Fail-open with logging |
| Frontend/backend mismatch | Sync constants via shared config |

## Implementation Plan

### Phase 1: Backend Quota Constants

**File**: `apps/api/src/shared/constants/quotas.ts` (NEW)

```typescript
/**
 * Free tier quota limits
 * These can be overridden per environment or subscription tier
 */
export const FREE_TIER_QUOTAS = {
  /** Maximum URLs per batch request */
  MAX_URLS_PER_BATCH: 5,
  /** Maximum AI-enabled URLs per batch */
  MAX_AI_URLS_PER_BATCH: 5,
  /** Maximum AI-enabled URLs per day per session */
  MAX_AI_URLS_PER_DAY: 10,
} as const;

export type QuotaLimits = typeof FREE_TIER_QUOTAS;
```

### Phase 2: Redis Key for AI Daily Quota

**File**: `apps/api/src/shared/constants/redis-keys.ts`

Add new key pattern:

```typescript
/**
 * AI daily quota tracking per session
 * Pattern: ai_quota_daily:{sessionId}:{date}
 * TTL: 24 hours
 * Usage: Track AI URLs scanned per session per day
 */
AI_QUOTA_DAILY: {
  pattern: 'ai_quota_daily',
  build: (sessionId: string, date: string) => `ai_quota_daily:${sessionId}:${date}`,
  ttl: 86400, // 24 hours
},
```

### Phase 3: Update Batch Schema

**File**: `apps/api/src/modules/batches/batch.schema.ts`

Change line 80:
```typescript
// Before
.max(50, 'Maximum 50 URLs allowed per batch')

// After
.max(5, 'Maximum 5 URLs allowed per batch for free tier')
```

### Phase 4: Update Batch Service

**File**: `apps/api/src/modules/batches/batch.service.ts`

#### Change 4.1: Import quotas and Redis keys
```typescript
import { FREE_TIER_QUOTAS } from '../../shared/constants/quotas.js';
import { RedisKeys } from '../../shared/constants/redis-keys.js';
```

#### Change 4.2: Update hardcoded limit (lines 130-134)
```typescript
// Before
if (input.urls.length > 50) {
  throw new BatchServiceError(
    'Batch size limit exceeded (maximum 50 URLs)',
    'BATCH_SIZE_EXCEEDED'
  );
}

// After
if (input.urls.length > FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH) {
  throw new BatchServiceError(
    `Batch size limit exceeded (maximum ${FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH} URLs for free tier)`,
    'BATCH_SIZE_EXCEEDED'
  );
}
```

#### Change 4.3: Add AI batch limit check (before line 195)
```typescript
// Count AI-enabled URLs and validate
if (input.aiEnabled) {
  // Check AI batch limit
  if (validatedUrls.length > FREE_TIER_QUOTAS.MAX_AI_URLS_PER_BATCH) {
    throw new BatchServiceError(
      `AI batch limit exceeded (maximum ${FREE_TIER_QUOTAS.MAX_AI_URLS_PER_BATCH} AI URLs per batch)`,
      'AI_BATCH_LIMIT_EXCEEDED'
    );
  }

  // Check daily AI limit
  const dailyUsage = await checkDailyAiQuota(input.guestSessionId || input.userId || '');
  const remainingDaily = FREE_TIER_QUOTAS.MAX_AI_URLS_PER_DAY - dailyUsage;

  if (remainingDaily < validatedUrls.length) {
    throw new BatchServiceError(
      `Daily AI limit exceeded (${dailyUsage}/${FREE_TIER_QUOTAS.MAX_AI_URLS_PER_DAY} used today). ` +
      `${remainingDaily} AI scans remaining.`,
      'DAILY_AI_LIMIT_EXCEEDED'
    );
  }
}
```

#### Change 4.4: Add helper function for daily AI quota check
```typescript
/**
 * Check daily AI quota usage for a session
 */
async function checkDailyAiQuota(sessionId: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = RedisKeys.AI_QUOTA_DAILY.build(sessionId, today);
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('❌ Batch Service: Failed to check daily AI quota:', error);
    return 0; // Fail open
  }
}

/**
 * Increment daily AI quota usage for a session
 */
async function incrementDailyAiQuota(sessionId: string, count: number): Promise<void> {
  try {
    const redis = getRedisClient();
    const today = new Date().toISOString().split('T')[0];
    const key = RedisKeys.AI_QUOTA_DAILY.build(sessionId, today);

    const pipeline = redis.pipeline();
    pipeline.incrby(key, count);
    pipeline.expire(key, RedisKeys.AI_QUOTA_DAILY.ttl);
    await pipeline.exec();
  } catch (error) {
    console.error('❌ Batch Service: Failed to increment daily AI quota:', error);
  }
}
```

#### Change 4.5: Increment quota after successful AI reservation
After line 246 (after AI slots reserved):
```typescript
// Track daily AI usage
if (aiEnabledCount > 0 && (input.guestSessionId || input.userId)) {
  await incrementDailyAiQuota(input.guestSessionId || input.userId || '', aiEnabledCount);
}
```

### Phase 5: Update Frontend

**File**: `apps/web/src/lib/constants/quotas.ts` (NEW)

```typescript
export const FREE_TIER_QUOTAS = {
  MAX_URLS_PER_BATCH: 5,
  MAX_AI_URLS_PER_BATCH: 5,
  MAX_AI_URLS_PER_DAY: 10,
} as const;
```

**File**: `apps/web/src/components/features/scan/ScanForm.tsx`

Add validation before submission:
```typescript
// In handleSubmit, after URL validation
if (isBatchMode && batchUrls.length > FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH) {
  throw new Error(
    `Maximum ${FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH} URLs allowed per batch. ` +
    `Please remove ${batchUrls.length - FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH} URLs.`
  );
}

if (aiEnabled && isBatchMode && batchUrls.length > FREE_TIER_QUOTAS.MAX_AI_URLS_PER_BATCH) {
  throw new Error(
    `Maximum ${FREE_TIER_QUOTAS.MAX_AI_URLS_PER_BATCH} URLs allowed with AI enabled. ` +
    `Please disable AI or remove some URLs.`
  );
}
```

**File**: `apps/web/src/components/features/batch/BatchUrlTable.tsx`

Add quota indicator:
```typescript
// Show warning when approaching limit
{urls.length > FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH && (
  <div className="text-amber-600 text-sm mt-2">
    Limit exceeded: {urls.length}/{FREE_TIER_QUOTAS.MAX_URLS_PER_BATCH} URLs (free tier)
  </div>
)}
```

### Phase 6: Error Response Schema

**New error codes to document**:

| Code | HTTP Status | Message |
|------|-------------|---------|
| `BATCH_SIZE_EXCEEDED` | 400 | Maximum X URLs allowed per batch |
| `AI_BATCH_LIMIT_EXCEEDED` | 400 | Maximum X AI URLs allowed per batch |
| `DAILY_AI_LIMIT_EXCEEDED` | 429 | Daily AI limit exceeded (X/Y used today) |

## Testing Strategy

### Unit Tests

1. **batch.service.test.ts**
   - Test batch rejection at 6 URLs
   - Test AI batch rejection at 6 AI URLs
   - Test daily AI limit enforcement
   - Test quota tracking in Redis

2. **rate-limit.test.ts**
   - Test AI quota Redis key creation
   - Test daily reset behavior

### Integration Tests

1. Create batch with 5 URLs - should succeed
2. Create batch with 6 URLs - should fail with `BATCH_SIZE_EXCEEDED`
3. Create AI batch with 5 URLs - should succeed
4. Create AI batch with 6 URLs - should fail with `AI_BATCH_LIMIT_EXCEEDED`
5. Create 10 AI scans in one day - should succeed
6. Create 11th AI scan - should fail with `DAILY_AI_LIMIT_EXCEEDED`

### Manual Testing Checklist

- [ ] Frontend shows correct limits in BatchUrlTable
- [ ] Error messages are clear and actionable
- [ ] Daily limit resets at midnight
- [ ] Quota errors include upgrade path suggestion

## Rollback Plan

1. Revert `batch.schema.ts` max to 50
2. Revert `batch.service.ts` hardcoded checks
3. Remove AI quota tracking code
4. Keep Redis key definition (no harm)
5. Revert frontend quota validation

**Estimated rollback time**: 15 minutes

---

**Analysis Completed**: 2026-01-10
**Ready for**: Implementation phase (`/bug-fix`)
