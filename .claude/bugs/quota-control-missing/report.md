# Bug Report: Missing Quota Control for Batch Scan and AI Scan

## Bug Summary
The application lacks proper quota control for batch scans and AI scans. Currently there are no limits on:
1. Maximum URLs per batch scan (currently allows up to 50 URLs)
2. Maximum URLs with AI enabled per batch
3. Daily AI scan limits per user/session

## Bug Details

### Expected Behavior
The system should enforce the following quotas for guest/free users:
1. **Batch Scan**: Maximum 5 URLs per batch request
2. **AI Scan (per batch)**: Maximum 5 URLs with AI enabled per batch
3. **AI Scan (daily)**: Maximum 10 AI-enabled URLs per day per user/session

In the future, subscription accounts should have higher limits based on their plan.

### Actual Behavior
- **Batch Scan**: Currently allows up to 50 URLs per batch (defined in `batch.schema.ts`)
- **AI Scan (per batch)**: No limit on AI-enabled URLs within a batch
- **AI Scan (daily)**: Only controlled by global campaign token budget, not per-user daily limit

### Steps to Reproduce
1. Navigate to the scan form
2. Enable "Discover URLs" to find pages
3. Select more than 5 URLs
4. Enable AI scan option
5. Submit - System accepts the request without quota enforcement
6. Repeat multiple times in the same day - No daily limit enforced

### Environment
- **Version**: Current development build
- **Platform**: Web application (all browsers)
- **Configuration**: Default guest session

## Impact Assessment

### Severity
- [x] Medium - Feature impaired but workaround exists

### Affected Users
- All users (guests and potentially future subscribers)
- The lack of quotas could lead to abuse or resource exhaustion

### Affected Features
- Batch Scan creation
- AI Scan resource allocation
- System scalability and fair usage

## Additional Context

### Current Implementation Analysis

**Batch Schema (`apps/api/src/modules/batches/batch.schema.ts`)**
```typescript
urls: z.array(...)
  .min(1, 'At least 1 URL is required')
  .max(50, 'Maximum 50 URLs allowed per batch')  // Too high for free tier
```

**Rate Limit Middleware (`apps/api/src/shared/middleware/rate-limit.ts`)**
```typescript
BATCH_RATE_LIMIT_CONFIG = {
  MAX_URLS_PER_HOUR: 100,  // Controls total URLs per hour, not per batch
}
```

**AI Campaign Service (`apps/api/src/modules/ai-campaign/ai-campaign.service.ts`)**
- Controls global campaign token budget (slots remaining)
- No per-user or per-session daily limits
- No limit on AI-enabled URLs within a single batch

### Error Messages
No error messages currently - the feature simply doesn't exist.

### Screenshots/Media
N/A

### Related Issues
- Previous bug fixes for AI scan integration with batch scans
- Rate limiting middleware exists but doesn't address these specific quotas

## Initial Analysis

### Suspected Root Cause
The quota system was designed for higher limits (50 URLs per batch) without considering:
1. Free tier limitations
2. AI resource costs per URL
3. Daily usage caps to prevent abuse
4. Subscription-based tiered limits

### Affected Components

| Component | File | Issue |
|-----------|------|-------|
| Batch Schema | `apps/api/src/modules/batches/batch.schema.ts` | Max URLs set to 50, should be 5 for free tier |
| Batch Service | `apps/api/src/modules/batches/batch.service.ts` | No AI URL count validation |
| AI Campaign Service | `apps/api/src/modules/ai-campaign/ai-campaign.service.ts` | No daily per-user limit |
| Frontend Form | `apps/web/src/components/features/scan/ScanForm.tsx` | Should enforce URL limits before submission |
| Rate Limit Middleware | `apps/api/src/shared/middleware/rate-limit.ts` | Per-hour limit, not per-request quota |

### Proposed Quota Structure

| User Type | Max URLs/Batch | Max AI URLs/Batch | Max AI URLs/Day |
|-----------|---------------|-------------------|-----------------|
| Guest/Free | 5 | 5 | 10 |
| Basic (future) | 20 | 10 | 50 |
| Pro (future) | 50 | 25 | 200 |
| Enterprise (future) | Unlimited | 100 | 1000 |

## Market Research Alignment

### From `docs/analysis/AI_Enhanced_Accessibility_Testing_Feasibility.md`

The feasibility analysis (Section 5 - Cost Analysis) recommends tiered pricing:

| Plan | Pages/month | AI Analysis | Price |
|------|-------------|-------------|-------|
| **Free** | 10 | ❌ No | $0 |
| **Starter** | 100 | ⚠️ Limited | $29/mo |
| **Pro** | 500 | ✅ Full | $149/mo |
| **Enterprise** | 2000+ | ✅ Full + Custom | $499/mo |

**Key Cost Factors:**
- Per-page AI scanning cost: **$0.10-0.20** (GPT-4 Vision for images, text analysis)
- Alt text analysis (5 images): $0.05
- Link text evaluation: $0.02
- Heading analysis: $0.01
- Screenshot analysis: $0.03

### From `docs/analysis/ADA_WCAG_RESEARCH_TARGET_CUSTOMERS.md`

Recommended pricing strategy (Section 9):

| Tier | Price | Target | Features |
|------|-------|--------|----------|
| **Free** | $0 | Lead gen | **3 pages/day**, basic report |
| **Starter** | $29-49/scan | One-time | Full site scan |
| **Pro** | $49-99/month | SMB | 10 sites, weekly monitoring |
| **Agency** | $199-499/month | Agencies | White-label, unlimited |
| **Enterprise** | $1,000+/year | Large orgs | Custom, SSO, SLA |

### Recommended Quota Alignment

Based on market research, the quota structure should align with:

1. **Free Tier Focus**: Lead generation - strict limits to encourage upgrades
2. **AI Cost Control**: AI analysis is expensive ($0.10-0.20/page) - must be limited
3. **Daily Limits**: Prevent abuse while allowing meaningful free usage
4. **Batch Limits**: Control resource consumption per request

### Updated Proposed Quotas (Aligned with Research)

| User Type | Max URLs/Batch | Max AI URLs/Batch | Max AI URLs/Day | Pages/Day |
|-----------|---------------|-------------------|-----------------|-----------|
| **Guest/Free** | 5 | 5 | 10 | 3 |
| **Starter** (future) | 10 | 5 | 20 | 10 |
| **Pro** (future) | 25 | 15 | 100 | 50 |
| **Agency** (future) | 50 | 30 | 500 | Unlimited |
| **Enterprise** (future) | Unlimited | 100 | 2000 | Unlimited |

---

**Report Status**: ANALYZED - Ready for `/bug-fix` phase

