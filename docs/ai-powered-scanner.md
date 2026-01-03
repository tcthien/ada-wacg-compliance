# AI-Powered Accessibility Scanner

## Overview

This document outlines the plan for implementing AI-enhanced accessibility scanning using a local Claude Code execution model for the MVP phase.

---

## Architecture

### High-Level Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   USER      │         │   SERVER    │         │  LOCAL PC   │
│   (Web)     │         │   (API)     │         │  (Operator) │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Submit scan       │                       │
       │  (URL + email +       │                       │
       │   aiEarlyBird=true)   │                       │
       │──────────────────────►│                       │
       │                       │                       │
       │                       │  2. Save to           │
       │                       │  AI_PENDING queue     │
       │                       │                       │
       │  3. "AI scan queued"  │                       │
       │◄──────────────────────│                       │
       │                       │                       │
       │                       │  4. Download CSV      │
       │                       │  (pending AI scans)   │
       │                       │──────────────────────►│
       │                       │                       │
       │                       │                       │  5. Claude Code
       │                       │                       │  analyzes each
       │                       │                       │  scan result
       │                       │                       │
       │                       │  6. Upload CSV        │
       │                       │  (AI results +        │
       │                       │   token usage)        │
       │                       │◄──────────────────────│
       │                       │                       │
       │                       │  7. Update DB         │
       │                       │  (AI enhancements +   │
       │                       │   deduct quota)       │
       │                       │                       │
       │  8. Email: Complete   │                       │
       │  report (standard +   │                       │
       │  AI combined)         │                       │
       │◄──────────────────────│                       │
```

### Key Principle

The final deliverable is a **single combined report** containing:
- Standard axe-core scan results (issues, selectors, WCAG criteria)
- AI enhancements (explanations, fix suggestions, priority rankings)

Users receive **one email** with **one report** — not separate deliveries.

---

## Phase 1: MVP "Early Bird AI Scan"

### Concept

A limited-time campaign offering AI-enhanced accessibility analysis. Users get premium AI features for free until the token budget runs out — creating urgency and gathering feedback before paid launch.

### Execution Model

- **No API costs in MVP** — uses local Claude Code CLI
- **Batch processing** — operator runs script manually or on schedule
- **Async delivery** — results sent via email within 24 hours

---

## User Flow

### Step 1: Standard Scan

User submits URL → System runs axe-core scan immediately → Results displayed

### Step 2: AI Enhancement Request

On the results page, user sees the Early Bird AI option:

```
┌───────────────────────────────────────────────────────────────┐
│ 🐣 EARLY BIRD AI ENHANCEMENT                        [BETA]    │
│                                                               │
│ Want AI-powered insights for your scan results?              │
│                                                               │
│ ✓ Plain-language explanations                                │
│ ✓ Specific fix suggestions                                   │
│ ✓ Priority-ranked remediation plan                           │
│                                                               │
│ Email * ┌────────────────────────────────┐                   │
│         │ user@example.com               │                   │
│         └────────────────────────────────┘                   │
│                                                               │
│ ☑ I want AI-enhanced analysis (sent via email)               │
│                                                               │
│ ⚠️ Note: AI analysis is processed in batches.                │
│    You'll receive results within 24 hours.                   │
│                                                               │
│ Campaign: ████████░░░░ 234 of 500 slots remaining            │
│                                                               │
│         [ Request AI Analysis ]                               │
└───────────────────────────────────────────────────────────────┘
```

### Step 3: Confirmation

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ✅ AI Analysis Requested!                                  │
│                                                              │
│  We've queued your scan for AI enhancement.                 │
│                                                              │
│  📧 Results will be sent to: user@example.com               │
│  ⏱️ Expected delivery: Within 24 hours                      │
│                                                              │
│  What happens next:                                          │
│  1. Our AI analyzes your 23 accessibility issues            │
│  2. We generate fix suggestions and priority rankings       │
│  3. You receive a detailed report via email                 │
│                                                              │
│  [ View Standard Results Now ]  [ Back to Home ]            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Email Delivery

User receives one email containing the complete report (standard + AI combined).

---

## AI Enhancement Features

| Feature | Description |
|---------|-------------|
| **Plain-Language Explanation** | Non-technical description of each issue and why it matters |
| **Fix Suggestion** | Step-by-step instructions with code examples to resolve the issue |
| **Priority Score** | 1-10 business impact ranking with reasoning |
| **Executive Summary** | 2-3 paragraph overview for stakeholders |
| **Remediation Roadmap** | Prioritized fix order with time estimates |

---

## Landing Page

### URL: `/early-bird`

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                    🐣                                                    │
│                                                                          │
│            EARLY BIRD AI ACCESSIBILITY SCAN                             │
│                                                                          │
│     Get AI-powered accessibility insights — completely free             │
│            (Limited to first 500 scans)                                 │
│                                                                          │
│         ████████████░░░░░░░░  234 spots remaining                       │
│                                                                          │
│                  [ Get Your Free AI Scan ]                              │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  HOW IT WORKS                                                           │
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │     📝       │   │     🤖       │   │     📧       │                │
│  │  1. SCAN     │   │  2. AI       │   │  3. RECEIVE  │                │
│  │              │   │  ANALYSIS    │   │              │                │
│  │ Run a free   │──►│ Our AI       │──►│ Get detailed │                │
│  │ accessibility│   │ analyzes     │   │ report with  │                │
│  │ scan on your │   │ each issue   │   │ fix guides   │                │
│  │ website      │   │ & suggests   │   │ via email    │                │
│  │              │   │ fixes        │   │              │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WHAT YOU GET                                                           │
│                                                                          │
│  ✅ Plain-Language Explanations                                         │
│     Understand each issue without technical jargon                      │
│                                                                          │
│  ✅ Specific Fix Suggestions                                            │
│     Step-by-step instructions to resolve each issue                     │
│                                                                          │
│  ✅ Priority Ranking                                                    │
│     Know which issues to fix first for maximum impact                   │
│                                                                          │
│  ✅ Remediation Roadmap                                                 │
│     Complete action plan with time estimates                            │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WHY FREE?                                                              │
│                                                                          │
│  We're building the next generation of accessibility tools.            │
│  Early Bird users help us refine our AI analysis before                │
│  official launch. In return, you get premium features free.            │
│                                                                          │
│  ⚠️ Campaign ends when we reach 500 scans or exhaust our              │
│     AI processing budget — whichever comes first.                      │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SAMPLE AI ANALYSIS                                                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔴 Missing Alt Text on Product Images                           │   │
│  │    Priority: 9/10 | WCAG 1.1.1                                  │   │
│  │                                                                  │   │
│  │ 📖 What this means:                                              │   │
│  │ Your product images don't have alternative text. Screen         │   │
│  │ reader users (about 7 million in the US) cannot understand      │   │
│  │ what these images show, potentially losing sales.               │   │
│  │                                                                  │   │
│  │ 🔧 How to fix:                                                   │   │
│  │ Add descriptive alt text to each product image. Example:        │   │
│  │ Change: <img src="shoe.jpg">                                    │   │
│  │ To: <img src="shoe.jpg" alt="Nike Air Max 90, white with       │   │
│  │     red accents, side view">                                    │   │
│  │                                                                  │   │
│  │ ⏱️ Time to fix: ~5 minutes per image                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                     READY TO TRY?                                       │
│                                                                          │
│            [ Start Your Free AI Scan Now ]                              │
│                                                                          │
│              234 of 500 spots remaining                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Local Processing Script

### Operations Flow

```
┌─────────────────┐
│  1. DOWNLOAD    │  GET /api/v1/admin/ai-queue/export
│     PENDING     │  → Returns CSV of pending AI scan requests
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  pending_ai_scans.csv                                            │
│                                                                  │
│  scan_id, url, email, issues_json, requested_at                 │
│  abc123, example.com, user@..., [{...}], 2025-01-01T10:00:00   │
│  def456, shop.com, buyer@..., [{...}], 2025-01-01T10:05:00     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  2. PROCESS     │  For each scan:
│  WITH CLAUDE    │  - Read issues from CSV
│  CODE CLI       │  - Invoke Claude Code with prompt
└────────┬────────┘  - Capture AI analysis output
         │           - Record token usage
         │           - Write to results CSV
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ai_results.csv                                                  │
│                                                                  │
│  scan_id, ai_summary, ai_issues_json, tokens_used, processed_at │
│  abc123, "This site has...", [{...}], 4523, 2025-01-01T12:00   │
│  def456, "The shop...", [{...}], 3891, 2025-01-01T12:15        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  3. UPLOAD      │  POST /api/v1/admin/ai-queue/import
│     RESULTS     │  → Uploads results CSV
└────────┬────────┘  → Server updates database
         │           → Deducts tokens from quota
         │           → Sends emails to users
         ▼
┌─────────────────┐
│  4. COMPLETE    │
└─────────────────┘
```

### Script Execution Example

```
$ ./process-ai-scans.sh

╔═══════════════════════════════════════════════════════════════╗
║           ADAShield AI Scan Processor v1.0                    ║
╚═══════════════════════════════════════════════════════════════╝

[1/4] Downloading pending AI scans...
      → Found 12 pending scans
      → Downloaded to: ./pending_ai_scans.csv

[2/4] Processing with Claude Code...
      → Processing scan 1/12: example.com
        Issues: 23 | Tokens used: 4,523
      → Processing scan 2/12: shop.com
        Issues: 45 | Tokens used: 6,891
      → Processing scan 3/12: blog.org
        Issues: 12 | Tokens used: 2,156
      ...
      → All 12 scans processed
      → Total tokens used: 48,234

[3/4] Uploading results...
      → Results uploaded successfully
      → 12 users will be notified

[4/4] Summary
      ────────────────────────────────
      Scans processed:    12
      Total tokens used:  48,234
      Quota remaining:    451,766 / 500,000
      Campaign status:    ACTIVE (90% remaining)
      ────────────────────────────────

✅ Complete!
```

---

## Quota Management

### Campaign Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│  EARLY BIRD CAMPAIGN STATUS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Campaign: "early-bird-jan-2025"                                │
│  Status: ACTIVE                                                  │
│                                                                  │
│  QUOTA (Token-based)                                            │
│  ───────────────────                                            │
│  Total Budget:    500,000 tokens                                │
│  Used:            48,234 tokens                                 │
│  Remaining:       451,766 tokens                                │
│  ████████████████████░░░░  90% remaining                        │
│                                                                  │
│  SCANS                                                          │
│  ─────                                                          │
│  Completed:       12 scans                                      │
│  Pending:         3 scans                                       │
│  Avg tokens/scan: 4,019 tokens                                  │
│  Est. remaining:  ~112 scans                                    │
│                                                                  │
│  DISPLAY TO USERS                                               │
│  ────────────────                                               │
│  Show as "slots": ~100 slots remaining                          │
│  (rounded down for buffer)                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Quota Display Rules

| Quota Level | User Display |
|-------------|--------------|
| > 20% | "X slots remaining" |
| 10-20% | "Limited slots! X remaining" + urgency styling |
| 5-10% | "Almost gone! Only X left" |
| < 5% | "Final slots available!" |
| 0% | Hide AI option, show "Campaign ended" message |

---

## Token Tracking

### Per-Scan Storage

| Field | Description | Example |
|-------|-------------|---------|
| `inputTokens` | Tokens for prompt (issues data) | 2,341 |
| `outputTokens` | Tokens for AI response | 3,182 |
| `totalTokens` | Sum of input + output | 5,523 |
| `model` | Claude model used | "claude-sonnet-4-20250514" |
| `processingTime` | Seconds to complete | 45 |

### Admin View

```
┌─────────────────────────────────────────────────────────────────┐
│  AI SCAN TOKEN USAGE                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Scan ID  │ URL           │ Issues │ Tokens │ Date          ││
│  ├──────────┼───────────────┼────────┼────────┼───────────────┤│
│  │ abc123   │ example.com   │ 23     │ 4,523  │ Jan 1, 10:00  ││
│  │ def456   │ shop.com      │ 45     │ 6,891  │ Jan 1, 10:15  ││
│  │ ghi789   │ blog.org      │ 12     │ 2,156  │ Jan 1, 10:30  ││
│  │ jkl012   │ news.com      │ 67     │ 8,234  │ Jan 1, 11:00  ││
│  └──────────┴───────────────┴────────┴────────┴───────────────┘│
│                                                                  │
│  Summary:                                                        │
│  • Total scans: 12                                              │
│  • Total tokens: 48,234                                         │
│  • Average tokens/scan: 4,019                                   │
│  • Highest: 8,234 (news.com - 67 issues)                       │
│  • Lowest: 1,523 (simple.io - 5 issues)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## AI Scan Request States

| State | Description |
|-------|-------------|
| `PENDING` | User requested, waiting for local processing |
| `DOWNLOADED` | Included in CSV download |
| `PROCESSING` | Currently being analyzed by Claude Code |
| `COMPLETED` | Results uploaded, email sent |
| `FAILED` | Processing error occurred |

---

## Combined Report Structure

The final report merges standard and AI results:

| Section | Source | Content |
|---------|--------|---------|
| Header | Standard | URL, scan date, WCAG level |
| Executive Summary | **AI** | Overview for stakeholders |
| Statistics | Standard | Issue counts by severity |
| Issue List | **Combined** | Each issue shows: standard details + AI explanation + AI fix suggestion |
| Remediation Roadmap | **AI** | Prioritized action plan with time estimates |
| Passed Checks | Standard | What's already compliant |

---

## Email Notification

### Template

```
┌─────────────────────────────────────────────────────────────────┐
│  FROM: ADAShield <noreply@adashield.dev>                        │
│  TO: user@example.com                                           │
│  SUBJECT: 🐣 Your AI Accessibility Analysis is Ready!           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Hi there,                                                       │
│                                                                  │
│  Great news! Our AI has finished analyzing the accessibility    │
│  scan for example.com.                                          │
│                                                                  │
│  QUICK SUMMARY                                                  │
│  ─────────────                                                  │
│  • 23 issues analyzed                                           │
│  • 5 critical issues need immediate attention                   │
│  • Estimated fix time: 6-8 hours                                │
│                                                                  │
│  TOP PRIORITY FIXES:                                            │
│  1. Add alt text to 12 product images                          │
│  2. Fix missing form labels on checkout                        │
│  3. Improve color contrast on navigation                       │
│                                                                  │
│           [ View Full AI Report ]                               │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  This report was generated as part of our Early Bird AI        │
│  campaign. Thank you for helping us improve!                    │
│                                                                  │
│  Questions? Reply to this email.                                │
│                                                                  │
│  — The ADAShield Team                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Requirements

### New Tables

| Table | Purpose |
|-------|---------|
| `AiEarlyBirdCampaign` | Campaign settings: quota, status, dates |
| `AiScanRequest` | Queue of pending AI enhancement requests |
| `AiScanResult` | AI analysis results and token usage |

### Extended Fields

| Table | New Fields |
|-------|------------|
| `Issue` | `aiExplanation`, `aiFixSuggestion`, `aiPriority` |
| `ScanResult` | `aiSummary`, `aiRemediationPlan`, `aiProcessedAt` |

---

## Phase 2: Subscription AI (Future)

After MVP validation, implement:

| Tier | Price/mo | AI Scans/month | Features |
|------|----------|----------------|----------|
| Free | $0 | 3 | Basic AI (explanations only) |
| Starter | $29 | 50 | Full AI + PDF reports |
| Pro | $99 | 200 | + Batch AI + API access |
| Agency | $299 | Unlimited | + White-label + Priority support |

### Required Infrastructure

- User authentication (Clerk/Auth0)
- Stripe billing integration
- Per-user token allocation
- Usage metering & alerts

---

## Summary: MVP Components

| Component | Description |
|-----------|-------------|
| **Scan Form Update** | Add AI checkbox + email field on results page |
| **Landing Page** | `/early-bird` promotional page |
| **AI Request Queue** | Database table for pending requests |
| **Local Script** | Download → Claude Code CLI → Upload flow |
| **Token Tracking** | Store usage per scan in database |
| **Quota Display** | Show remaining slots to users |
| **Admin Dashboard** | View queue, usage, campaign stats |
| **Email Notification** | Send combined report when ready |
| **Combined Report** | Single PDF/web report with standard + AI results |
