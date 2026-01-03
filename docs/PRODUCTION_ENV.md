# ADAShield Production Environment

This document outlines the production infrastructure requirements and configuration for deploying ADAShield.

## Infrastructure Requirements

### Runtime Requirements

| Component | Version | Notes |
|-----------|---------|-------|
| **Node.js** | `≥ 20.0.0` | LTS recommended (20.x or 22.x) |
| **pnpm** | `≥ 9.0.0` | Package manager |
| **npm** | `≥ 10.0.0` | Alternative to pnpm |

### Application Services

| Service | Port | Description |
|---------|------|-------------|
| **Web (Next.js)** | `3000` | Frontend application |
| **API (Fastify)** | `3080` | REST API server |
| **Worker** | - | Background job processor (no port exposed) |

### Database & Storage Services

| Service | Version | Port | Purpose |
|---------|---------|------|---------|
| **PostgreSQL** | `16` | `5432` | Primary database |
| **Redis** | `7` | `6379` | Cache & job queue (BullMQ) |
| **MinIO/S3** | `latest` | `9000` | File storage (reports, PDFs) |

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **Prisma** | `7.2.0` | Database ORM |
| **BullMQ** | `5.66.x` | Job queue |
| **Playwright** | `1.49.x` | Browser automation (scanning) |
| **axe-core** | `4.10.x` | WCAG testing engine |
| **Next.js** | `14.2.x` | React framework |
| **Fastify** | `4.25.x` | API framework |

---

## Production Hosting

### Primary Server (DirectAdmin)

| Property | Value |
|----------|-------|
| **Server IP** | `112.213.89.195` |
| **Hostname** | `gaziantep.maychu.cloud` |
| **Username** | `adashiel6955` |
| **Control Panel** | DirectAdmin |
| **OS** | CloudLinux 8 |
| **Credentials** | See `.credential/ssh-credential.txt` |

### DirectAdmin Node.js Application Setup

| Field | Value |
|-------|-------|
| **Application root** | `domains/adashield.dev/app` |
| **Application URL** | `adashield.dev` |
| **Application startup file** | `server.js` |
| **Node.js version** | `20.x` (or highest available) |
| **Application mode** | `Production` |

### Server Directory Structure

```
/home/adashiel6955/
├── domains/
│   └── adashield.dev/
│       ├── app/                 ← Application root (Node.js code)
│       │   ├── package.json
│       │   ├── .next/
│       │   ├── public/
│       │   └── node_modules/
│       ├── public_html/         ← Static files / symlink
│       └── private_html/
├── public_html -> ./domains/adashield.dev/public_html
├── Maildir/
└── tmp/
```

---

## Google Services Configuration

| Service | ID | Notes |
|---------|-----|-------|
| **GTM Container** | `GTM-P66HWFHR` | Google Tag Manager |
| **GA4 Measurement** | `G-RKPY7VD7TP` | Google Analytics 4 |
| **GA4 Property** | `properties/518015983` | Property ID |
| **Search Console** | `sc-domain:adashield.dev` | Domain-level verification |
| **Service Account** | `adashield-api@adashield-prod.iam.gserviceaccount.com` | GCP project: `adashield-prod` |

### reCAPTCHA v2

| Key Type | Value |
|----------|-------|
| **Site Key** | `6Lcl7DwsAAAAAL31IyLhKhb9zBi_Ry14_Pt7PYGe` |
| **Secret Key** | See `.credential/recaptchar-secret.txt` |

---

## Environment Variables

### Web Frontend (.env.production)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.adashield.dev

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lcl7DwsAAAAAL31IyLhKhb9zBi_Ry14_Pt7PYGe

# Google Analytics
NEXT_PUBLIC_GTM_ID=GTM-P66HWFHR
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-RKPY7VD7TP
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_ANALYTICS_DEBUG=false

# AI Early Bird Campaign
NEXT_PUBLIC_AI_EARLY_BIRD_ENABLED=true
```

### API Server (.env.production)

```bash
# Server Configuration
NODE_ENV=production
PORT=3080
HOST=0.0.0.0
API_PREFIX=/api/v1
LOG_LEVEL=info

# Application Environment (prod = require reCAPTCHA validation)
APP_ENV=prod

# CORS
CORS_ORIGIN=https://adashield.dev

# Security (generate unique secrets)
COOKIE_SECRET=<generate-random-secret>
JWT_SECRET=<generate-random-secret>
EMAIL_ENCRYPTION_KEY=<generate-64-char-hex>

# Database
DATABASE_URL=postgresql://user:password@host:5432/adashield?schema=public

# Redis
REDIS_URL=redis://host:6379/0

# reCAPTCHA
RECAPTCHA_SECRET_KEY=<from .credential/recaptchar-secret.txt>

# AWS S3 Storage (assets.adashield.dev bucket via Cloudflare CDN)
# Note: S3_ENDPOINT not needed for AWS S3 (only for MinIO)
S3_REGION=us-east-1
S3_ACCESS_KEY=<from .credential/aws-credential.txt>
S3_SECRET_KEY=<from .credential/aws-credential.txt>
S3_BUCKET=assets.adashield.dev
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_URL=https://assets.adashield.dev

# Email Configuration
EMAIL_DEFAULT_PROVIDER=SES
# AWS_SES_REGION=us-east-1
# AWS_ACCESS_KEY_ID=<key>
# AWS_SECRET_ACCESS_KEY=<secret>

# AI Early Bird Campaign
AI_EARLY_BIRD_ENABLED=true
AI_DEFAULT_TOKENS_PER_SCAN=100
AI_STALE_THRESHOLD_HOURS=48
```

### Worker (.env.production)

```bash
# Environment
NODE_ENV=production
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@host:5432/adashield?schema=public

# Redis
REDIS_URL=redis://host:6379/0

# Worker Configuration
WORKER_CONCURRENCY=5
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_TIMEOUT=30000

# AWS S3 Storage (assets.adashield.dev bucket via Cloudflare CDN)
# Note: S3_ENDPOINT not needed for AWS S3 (only for MinIO)
S3_REGION=us-east-1
S3_ACCESS_KEY=<from .credential/aws-credential.txt>
S3_SECRET_KEY=<from .credential/aws-credential.txt>
S3_BUCKET=assets.adashield.dev
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_URL=https://assets.adashield.dev

# Email Configuration
EMAIL_DEFAULT_PROVIDER=SES
```

---

## Credential Files

All credentials are stored in `.credential/` directory (gitignored):

| File | Purpose |
|------|---------|
| `adashield-prod-0c2377859697.json` | Google Service Account key (GCP APIs) |
| `aws-credential.txt` | AWS S3 credentials (access key, secret, bucket) |
| `cloudflare-api-key.txt` | Cloudflare API token |
| `recaptchar-secret.txt` | reCAPTCHA site key + secret |
| `ssh-credential.txt` | Production server SSH credentials |

---

## Production Architecture

### Current Setup (DirectAdmin Shared Hosting)

DirectAdmin shared hosting is suitable for the **Web Frontend** only.

```
┌─────────────────────────────────────────────────────────┐
│  DirectAdmin (112.213.89.195)                           │
│  └── Node.js App: Web Frontend (Next.js)                │
│      URL: https://adashield.dev                         │
└─────────────────────────────────────────────────────────┘
```

### Full Stack Architecture (Recommended)

For the complete application, additional infrastructure is needed:

```
┌─────────────────────────────────────────────────────────┐
│  DirectAdmin Hosting                                    │
│  └── Web Frontend (Next.js) → https://adashield.dev     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  VPS / Cloud Platform                                   │
│  ├── API Server (Fastify) → https://api.adashield.dev   │
│  ├── Worker (Playwright + BullMQ)                       │
│  ├── PostgreSQL 16                                      │
│  ├── Redis 7                                            │
│  └── MinIO/S3 Storage                                   │
└─────────────────────────────────────────────────────────┘
```

### Hosting Compatibility Matrix

| Component | DirectAdmin Shared | VPS/Dedicated | Managed Cloud |
|-----------|-------------------|---------------|---------------|
| Web Frontend | ✅ Yes | ✅ Yes | ✅ Yes |
| API Server | ⚠️ Limited* | ✅ Yes | ✅ Yes |
| Worker | ❌ No | ✅ Yes | ✅ Yes |
| PostgreSQL | ❌ No | ✅ Yes | ✅ Supabase/Neon |
| Redis | ❌ No | ✅ Yes | ✅ Upstash |
| S3 Storage | ❌ No | ✅ MinIO | ✅ Cloudflare R2/AWS S3 |

*DirectAdmin Node.js may not support long-running processes reliably*

---

## Deployment Checklist

### Pre-Deployment

- [ ] Generate unique secrets for `COOKIE_SECRET`, `JWT_SECRET`, `EMAIL_ENCRYPTION_KEY`
- [ ] Set up PostgreSQL database and run migrations
- [ ] Set up Redis instance
- [ ] Set up S3-compatible storage (MinIO or Cloudflare R2)
- [ ] Configure DNS records for `adashield.dev` and `api.adashield.dev`
- [ ] Obtain SSL certificates (Let's Encrypt)

### Google Services

- [ ] Publish GTM container (requires manual action in GTM UI)
- [ ] Verify GA4 is receiving data
- [ ] Confirm sitemap is accessible at `https://adashield.dev/sitemap.xml`

### Post-Deployment

- [ ] Verify health endpoints respond correctly
- [ ] Test reCAPTCHA integration
- [ ] Run a test accessibility scan
- [ ] Monitor error logs for first 24 hours

---

## Useful Commands

### SSH Access
```bash
ssh adashiel6955@112.213.89.195
```

### Build Commands
```bash
# Build all applications
pnpm build

# Build specific app
pnpm --filter @adashield/web build
pnpm --filter @adashield/api build
pnpm --filter @adashield/worker build
```

### Database Commands
```bash
# Run migrations
pnpm --filter @adashield/api prisma:migrate:deploy

# Seed database
pnpm --filter @adashield/api prisma:seed
```
