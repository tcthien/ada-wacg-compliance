# Post-MVP: Discovery Tier Limits

> **Status**: Planning (Post-MVP)
> **Priority**: Phase 2
> **Dependencies**: MVP Discovery feature complete

## Overview

This document outlines the tiered discovery limits to be implemented after MVP. The MVP will include the database schema and seeder with free tier configuration only.

## Proposed Tier Structure

### Discovery Limits by Plan

| Plan | Price | Discoveries/Month | Max Pages/Discovery | Max Depth | AI Discovery |
|------|-------|-------------------|---------------------|-----------|--------------|
| **Free** | $0 | 3 | 10 | 1 | No |
| **Starter** | $29/mo | 10 | 500 | 2 | No |
| **Pro** | $149/mo | Unlimited | 1,000 | 3 | Yes |
| **Enterprise** | $499/mo | Unlimited | 5,000 | 3 | Yes + Batch |

### MVP Implementation (Free Tier Only)

```
discoveries_per_month: 3
max_pages_per_discovery: 10
max_depth: 1
ai_discovery_enabled: false
```

## Database Schema

### Plans Table (exists or to be created)

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- 'free', 'starter', 'pro', 'enterprise'
  display_name TEXT NOT NULL,
  price_monthly INTEGER DEFAULT 0,  -- in cents
  price_yearly INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Plan Limits Table

```sql
CREATE TABLE plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  feature TEXT NOT NULL,  -- 'discovery', 'scan', 'report', etc.
  limit_type TEXT NOT NULL,  -- 'per_month', 'per_discovery', 'max_depth', 'boolean'
  limit_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, feature, limit_type)
);
```

### Customer Plan Assignment

```sql
-- Add to existing customers table or create
ALTER TABLE customers ADD COLUMN plan_id UUID REFERENCES plans(id);
ALTER TABLE customers ADD COLUMN ai_discovery_override BOOLEAN DEFAULT NULL;
-- NULL = use plan default, true/false = admin override
```

## Seeder Data (MVP)

```sql
-- Insert free plan
INSERT INTO plans (name, display_name, price_monthly, price_yearly, is_active)
VALUES ('free', 'Free', 0, 0, true);

-- Insert free plan limits
INSERT INTO plan_limits (plan_id, feature, limit_type, limit_value)
SELECT id, 'discovery', 'per_month', 3 FROM plans WHERE name = 'free'
UNION ALL
SELECT id, 'discovery', 'max_pages', 10 FROM plans WHERE name = 'free'
UNION ALL
SELECT id, 'discovery', 'max_depth', 1 FROM plans WHERE name = 'free'
UNION ALL
SELECT id, 'discovery', 'ai_enabled', 0 FROM plans WHERE name = 'free';
```

## Post-MVP Seeder Data

```sql
-- Starter plan
INSERT INTO plans (name, display_name, price_monthly, price_yearly, is_active)
VALUES ('starter', 'Starter', 2900, 29000, true);

INSERT INTO plan_limits (plan_id, feature, limit_type, limit_value)
SELECT id, 'discovery', 'per_month', 10 FROM plans WHERE name = 'starter'
UNION ALL
SELECT id, 'discovery', 'max_pages', 500 FROM plans WHERE name = 'starter'
UNION ALL
SELECT id, 'discovery', 'max_depth', 2 FROM plans WHERE name = 'starter'
UNION ALL
SELECT id, 'discovery', 'ai_enabled', 0 FROM plans WHERE name = 'starter';

-- Pro plan
INSERT INTO plans (name, display_name, price_monthly, price_yearly, is_active)
VALUES ('pro', 'Pro', 14900, 149000, true);

INSERT INTO plan_limits (plan_id, feature, limit_type, limit_value)
SELECT id, 'discovery', 'per_month', -1 FROM plans WHERE name = 'pro'  -- -1 = unlimited
UNION ALL
SELECT id, 'discovery', 'max_pages', 1000 FROM plans WHERE name = 'pro'
UNION ALL
SELECT id, 'discovery', 'max_depth', 3 FROM plans WHERE name = 'pro'
UNION ALL
SELECT id, 'discovery', 'ai_enabled', 1 FROM plans WHERE name = 'pro';

-- Enterprise plan
INSERT INTO plans (name, display_name, price_monthly, price_yearly, is_active)
VALUES ('enterprise', 'Enterprise', 49900, 499000, true);

INSERT INTO plan_limits (plan_id, feature, limit_type, limit_value)
SELECT id, 'discovery', 'per_month', -1 FROM plans WHERE name = 'enterprise'
UNION ALL
SELECT id, 'discovery', 'max_pages', 5000 FROM plans WHERE name = 'enterprise'
UNION ALL
SELECT id, 'discovery', 'max_depth', 3 FROM plans WHERE name = 'enterprise'
UNION ALL
SELECT id, 'discovery', 'ai_enabled', 1 FROM plans WHERE name = 'enterprise';
```

## AI Discovery Features (Pro+ Only)

### Basic Discovery (All Tiers)
- Sitemap.xml parsing
- Navigation extraction via CSS selectors (`<nav>`, `<header>`, `.nav`, `.menu`)
- Internal link crawling
- URL-based deduplication

### AI-Enhanced Discovery (Pro+ Only)
- Smart navigation detection (ML-based pattern recognition)
- JavaScript-rendered content extraction
- Content similarity deduplication
- Automatic page categorization (product, blog, contact, etc.)
- SPA route detection

### Admin Override Feature

Admins can toggle AI discovery for specific customers regardless of plan:

```typescript
interface Customer {
  id: string;
  planId: string;
  aiDiscoveryOverride: boolean | null;  // null = use plan default
}

function isAiDiscoveryEnabled(customer: Customer, plan: Plan): boolean {
  if (customer.aiDiscoveryOverride !== null) {
    return customer.aiDiscoveryOverride;  // Admin override
  }
  return plan.limits.aiEnabled;  // Plan default
}
```

## Usage Tracking

```sql
CREATE TABLE discovery_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  month DATE NOT NULL,  -- First day of month (e.g., '2025-01-01')
  discovery_count INTEGER DEFAULT 0,
  pages_discovered INTEGER DEFAULT 0,
  ai_discoveries INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, month)
);
```

## Limit Enforcement Logic

```typescript
async function canStartDiscovery(
  customerId: string,
  requestedDepth: number,
  requestedPageLimit: number
): Promise<{ allowed: boolean; reason?: string }> {
  const customer = await getCustomer(customerId);
  const plan = await getPlan(customer.planId);
  const usage = await getMonthlyUsage(customerId);
  const limits = await getPlanLimits(plan.id, 'discovery');

  // Check monthly discovery limit
  if (limits.perMonth !== -1 && usage.discoveryCount >= limits.perMonth) {
    return {
      allowed: false,
      reason: `Monthly discovery limit reached (${limits.perMonth})`
    };
  }

  // Check depth limit
  if (requestedDepth > limits.maxDepth) {
    return {
      allowed: false,
      reason: `Depth ${requestedDepth} exceeds plan limit (${limits.maxDepth})`
    };
  }

  // Check page limit
  if (requestedPageLimit > limits.maxPages) {
    return {
      allowed: false,
      reason: `Page limit ${requestedPageLimit} exceeds plan limit (${limits.maxPages})`
    };
  }

  return { allowed: true };
}
```

## Migration Path

1. **MVP**: Deploy with free tier hardcoded in seeder
2. **Phase 2**: Add Starter/Pro plans, payment integration
3. **Phase 3**: Add Enterprise plan, AI discovery features
4. **Phase 4**: Admin override UI, usage analytics dashboard

## Research Sources

- [Screaming Frog Pricing](https://www.screamingfrog.co.uk/seo-spider/pricing/) - 500 URL free limit
- [Sitebulb Pricing](https://www.saasworthy.com/product/website-crawler/pricing) - Tiered by URL count
- [Octopus.do](https://octopus.do/sitemap/generator) - 300 page free crawl limit
- [WAVE API](https://www.whoisaccessible.com/reviews/siteimprove/) - $4K/yr for 100K tests

---

*Document Version: 1.0*
*Created: December 2024*
*Status: Post-MVP Planning*
