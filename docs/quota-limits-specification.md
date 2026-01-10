# Quota & Limits Specification

**Created:** 2026-01-10
**Version:** 1.0
**Status:** Draft

---

## Overview

This document defines the quota and limit specifications for ADAShield's scanning services. These limits are designed to:

1. Control resource costs (especially AI analysis at $0.10-0.20/page)
2. Prevent abuse and ensure fair usage
3. Encourage upgrades from free to paid tiers
4. Align with market positioning (free tier for lead generation)

---

## 1. Current State (As of 2026-01-10)

### Existing Limits

| Limit Type | Current Value | Location |
|------------|---------------|----------|
| Max URLs per batch | 50 | `batch.schema.ts` |
| URLs per hour (rate limit) | 100 | `rate-limit.ts` |
| AI slots | Campaign-based | `ai-campaign.service.ts` |
| Daily AI limit per user | None | Not implemented |
| AI URLs per batch | None | Not implemented |

### Problems

- Batch limit (50 URLs) is too high for free tier
- No per-batch AI URL limit
- No per-user daily AI limit
- Rate limit is hourly, not per-request quota

---

## 2. Proposed Quota Structure

### 2.1 Guest/Free Tier (Current Focus)

| Quota Type | Limit | Rationale |
|------------|-------|-----------|
| **Max URLs per batch** | 5 | Prevent resource abuse |
| **Max AI URLs per batch** | 5 | Control AI costs |
| **Max AI URLs per day** | 10 | Daily cap per session |
| **Max pages per day** | 3 | Lead generation focus (market standard) |

### 2.2 Future Subscription Tiers

| Tier | URLs/Batch | AI URLs/Batch | AI URLs/Day | Pages/Day | Price |
|------|------------|---------------|-------------|-----------|-------|
| **Guest/Free** | 5 | 5 | 10 | 3 | $0 |
| **Starter** | 10 | 5 | 20 | 10 | $29/mo |
| **Pro** | 25 | 15 | 100 | 50 | $99/mo |
| **Agency** | 50 | 30 | 500 | Unlimited | $299/mo |
| **Enterprise** | Unlimited | 100 | 2000 | Unlimited | Custom |

---

## 3. Implementation Requirements

### 3.1 Batch Scan Quotas

**Location:** `apps/api/src/modules/batches/`

```typescript
// Free tier constants
const FREE_TIER_LIMITS = {
  MAX_URLS_PER_BATCH: 5,
  MAX_AI_URLS_PER_BATCH: 5,
  MAX_AI_URLS_PER_DAY: 10,
};
```

**Validation Points:**
1. Schema validation: Reject batches with >5 URLs
2. Service validation: Count AI-enabled URLs in batch
3. Daily limit check: Track AI usage per session/user

### 3.2 AI Scan Quotas

**Location:** `apps/api/src/modules/ai-campaign/`

```typescript
// AI quota tracking
interface AiQuotaUsage {
  sessionId: string;
  date: string; // YYYY-MM-DD
  aiUrlsUsed: number;
  lastUpdated: Date;
}
```

**Tracking Method:**
- Use Redis for daily AI usage tracking per session
- Key format: `ai:quota:{sessionId}:{date}`
- TTL: 24 hours (auto-expire at end of day)

### 3.3 Frontend Validation

**Location:** `apps/web/src/components/features/scan/ScanForm.tsx`

- Display quota limits in UI
- Disable URL selection beyond limit
- Show warning when approaching AI daily limit
- Display remaining quota to user

---

## 4. Error Messages

### 4.1 Batch URL Limit

```json
{
  "error": "BATCH_URL_LIMIT_EXCEEDED",
  "message": "Maximum 5 URLs allowed per batch for free tier",
  "limit": 5,
  "requested": 10,
  "upgrade_url": "/pricing"
}
```

### 4.2 AI URLs Per Batch Limit

```json
{
  "error": "AI_BATCH_LIMIT_EXCEEDED",
  "message": "Maximum 5 AI-enabled URLs allowed per batch",
  "limit": 5,
  "requested": 8,
  "suggestion": "Disable AI for some URLs or upgrade your plan"
}
```

### 4.3 Daily AI Limit

```json
{
  "error": "DAILY_AI_LIMIT_EXCEEDED",
  "message": "Daily AI scan limit reached (10 URLs/day)",
  "limit": 10,
  "used": 10,
  "resets_at": "2026-01-11T00:00:00Z",
  "upgrade_url": "/pricing"
}
```

---

## 5. Market Research Alignment

### 5.1 Competitor Analysis

| Competitor | Free Tier Limits |
|------------|------------------|
| WAVE | 3 pages/day |
| accessiBe | No free tier |
| Siteimprove | Enterprise only |
| Lighthouse | Unlimited (no AI) |

### 5.2 Cost Justification

From `docs/analysis/AI_Enhanced_Accessibility_Testing_Feasibility.md`:

| AI Operation | Cost/Page |
|--------------|-----------|
| Alt text analysis (5 images) | $0.05 |
| Link text evaluation | $0.02 |
| Heading analysis | $0.01 |
| Screenshot analysis | $0.03 |
| **Total** | **$0.10-0.20** |

**Daily Cost Control:**
- Free tier: 10 AI URLs/day = $1-2/day max per user
- With 1000 daily users: $1,000-2,000/day potential cost
- Limits essential for sustainability

### 5.3 Lead Generation Strategy

From `docs/analysis/ADA_WCAG_RESEARCH_TARGET_CUSTOMERS.md`:

> Free tier purpose: Lead generation - strict limits to encourage upgrades

- 3 pages/day allows users to test the service
- Limited enough to encourage paid upgrades
- Matches market expectations (WAVE offers similar)

---

## 6. Database Schema (Future)

For subscription-based quotas:

```sql
-- User subscription plans
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  max_urls_per_batch INT NOT NULL,
  max_ai_urls_per_batch INT NOT NULL,
  max_ai_urls_per_day INT NOT NULL,
  max_pages_per_day INT,
  price_monthly DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- User quota usage tracking
CREATE TABLE quota_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  date DATE NOT NULL,
  urls_scanned INT DEFAULT 0,
  ai_urls_scanned INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date),
  UNIQUE(session_id, date)
);
```

---

## 7. Implementation Priority

### Phase 1: Immediate (Free Tier Enforcement)

1. [ ] Reduce batch URL limit from 50 to 5
2. [ ] Add AI URLs per batch validation (max 5)
3. [ ] Implement daily AI URL tracking per session
4. [ ] Update frontend to show/enforce limits

### Phase 2: Future (Subscription System)

1. [ ] Create subscription plans table
2. [ ] Implement user quota tracking
3. [ ] Build pricing page and upgrade flow
4. [ ] Add quota management API

---

## 8. Configuration

### Environment Variables

```bash
# Quota limits (can be overridden per environment)
FREE_TIER_MAX_URLS_PER_BATCH=5
FREE_TIER_MAX_AI_URLS_PER_BATCH=5
FREE_TIER_MAX_AI_URLS_PER_DAY=10
FREE_TIER_MAX_PAGES_PER_DAY=3
```

### Feature Flags

```typescript
const QUOTA_FEATURES = {
  ENFORCE_BATCH_URL_LIMIT: true,
  ENFORCE_AI_BATCH_LIMIT: true,
  ENFORCE_DAILY_AI_LIMIT: true,
  SHOW_UPGRADE_PROMPTS: true,
};
```

---

## 9. Monitoring & Alerts

### Metrics to Track

- Daily AI URL usage per session
- Quota limit hit rate (how often users hit limits)
- Upgrade conversion rate from quota limits
- Cost per user (AI spend)

### Alert Thresholds

- Alert if daily AI cost exceeds $500
- Alert if single session uses >50 AI URLs (potential abuse)
- Alert if quota enforcement fails

---

## References

- [AI Feasibility Analysis](./analysis/AI_Enhanced_Accessibility_Testing_Feasibility.md)
- [Target Customer Research](./analysis/ADA_WCAG_RESEARCH_TARGET_CUSTOMERS.md)
- [Market Validation Report](./analysis/ADA_WCAG_Research_Validation_Report.md)

---

*Document maintained by: Engineering Team*
