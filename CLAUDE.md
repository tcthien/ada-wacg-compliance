# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a planning/research repository for an **ADA/WCAG Compliance Testing Tool** - a web accessibility testing solution targeting SMBs, e-commerce sites, and agencies. The project is in the early research and planning phase.

## Project Goals

Build a testing tool (NOT an overlay/widget) using:
- **axe-core** - Primary WCAG testing engine from Deque Systems
- **Pa11y** - CLI tool combining axe-core + HTML CodeSniffer
- **Node.js** - Backend technology
- CI/CD integration with GitHub Actions, GitLab CI

Key positioning: Honest, transparent testing tool that doesn't overpromise (automated tools detect ~30% of WCAG issues).

## Repository Structure

```
docs/
├── analysis/          # Market research and validation reports (EN/VI)
├── blueprints/        # Technical design documents (empty - to be created)
└── requirements/      # Product requirements (empty - to be created)
```

## Target Standards

- WCAG 2.0, 2.1, 2.2 (Levels A, AA, AAA)
- ADA Title II/III compliance (US)
- EN 301 549 / EAA compliance (Europe)
- AODA/ACA (Canada)

## Key Deadlines Driving Development

- **June 2025**: EAA (European Accessibility Act) already in effect
- **April 2026**: ADA Title II deadline for US local governments >50k population
- **April 2027**: ADA Title II deadline for US local governments <50k population

## Target Markets (Priority Order)

1. USA (largest market, most lawsuits)
2. EU (27 countries, EAA penalties up to €3M)
3. UK (Equality Act 2010)
4. Canada (AODA, fines up to CAD 100k/day)

## Target Customers

- SMBs and E-commerce (77% of accessibility lawsuits)
- Web development agencies
- Local governments and school districts
- Healthcare organizations

## Development Servers

When running locally in development mode:

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |
| API Health | http://localhost:3080/api/v1/health |
| API Base | http://localhost:3080/api/v1 |

**Important**: The API runs on port **3080**, NOT 3000.

## Application Management Scripts

Use these scripts from the project root to manage the application servers:

| Script | Command | Description |
|--------|---------|-------------|
| Start | `./app-start.sh` | Start all services (API, Web, Worker) |
| Stop | `./app-stop.sh` | Stop all running services |
| Restart | `./app-restart.sh` | Stop and restart all services |

**Admin Credentials** (dev environment):
- Super Admin: `superadmin@adashield.dev` / `superadmin123`
- Admin: `admin@adashield.dev` / `admin123`

**Logs Location**: `.logs/` directory (api.log, web.log, worker.log)

## Production Configuration (adashield.dev)

### Google Services
| Service | ID | Notes |
|---------|-----|-------|
| GTM Container | `GTM-P66HWFHR` | Google Tag Manager |
| GA4 Measurement | `G-RKPY7VD7TP` | Google Analytics 4 |
| Search Console | `sc-domain:adashield.dev` | Domain-level verification |
| Service Account | `adashield-api@adashield-prod.iam.gserviceaccount.com` | GCP project: `adashield-prod` |

### reCAPTCHA v2
| Key Type | Value |
|----------|-------|
| Site Key | `6Lcl7DwsAAAAAL31IyLhKhb9zBi_Ry14_Pt7PYGe` |
| Secret Key | See `.credential/recaptchar-secret.txt` |

### Production Hosting (DirectAdmin)

| Property | Value |
|----------|-------|
| Server IP | `112.213.89.195` |
| Hostname | `gaziantep.maychu.cloud` |
| Username | `adashiel6955` |
| Control Panel | DirectAdmin |
| OS | CloudLinux 8 |
| Credentials | See `.credential/ssh-credential.txt` |

### Server Directory Structure

```
/home/adashiel6955/
├── domains/
│   └── adashield.dev/
│       ├── app/                 ← Application root (Node.js code)
│       │   ├── package.json
│       │   ├── server.js
│       │   ├── .next/
│       │   └── node_modules/
│       ├── public_html/         ← Static files
│       └── private_html/
└── tmp/
```

## Web Frontend Deployment

### Quick Deploy Commands

```bash
# 1. Build locally
cd /path/to/ada-wacg-compliance
pnpm build

# 2. Prepare standalone build
cd apps/web
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/ 2>/dev/null || true

# 3. Create deployment package
tar -czvf /tmp/adashield-web-deploy.tar.gz -C .next/standalone .

# 4. Upload to server
sshpass -p '<password>' scp -o StrictHostKeyChecking=no \
  /tmp/adashield-web-deploy.tar.gz \
  adashiel6955@112.213.89.195:/home/adashiel6955/domains/adashield.dev/

# 5. Extract on server
sshpass -p '<password>' ssh -o StrictHostKeyChecking=no adashiel6955@112.213.89.195 '
cd /home/adashiel6955/domains/adashield.dev && \
rm -rf app/* && \
tar -xzf adashield-web-deploy.tar.gz -C app/ && \
rm adashield-web-deploy.tar.gz'

# 6. Restart app in DirectAdmin UI
# Go to: DirectAdmin → Node.js App → Click "Restart"
```

### DirectAdmin Node.js App Settings

| Field | Value |
|-------|-------|
| Application root | `domains/adashield.dev/app` |
| Application URL | `adashield.dev` |
| Application startup file | `server.js` |
| Node.js version | `20.x` (or highest available) |
| Application mode | `Production` |

### Post-Deployment Verification

```bash
# Check if app is running
curl -I https://adashield.dev

# Check health endpoint
curl https://adashield.dev/api/health
```

### Troubleshooting

- **App not starting**: Check DirectAdmin → Node.js App for error logs
- **502 Bad Gateway**: Node.js app crashed, restart from DirectAdmin
- **Static assets 404**: Ensure `.next/static` was copied to standalone build

### Credential Files (DO NOT COMMIT)
All credentials are stored in `.credential/` directory (gitignored):

| File | Purpose |
|------|---------|
| `adashield-prod-0c2377859697.json` | Google Service Account key (GCP APIs) |
| `cloudflare-api-key.txt` | Cloudflare API token |
| `recaptchar-secret.txt` | reCAPTCHA site key + secret |
| `ssh-credential.txt` | Production server SSH credentials |

### Environment Variables for Production
```bash
# Web (.env.production)
NEXT_PUBLIC_GTM_ID=GTM-P66HWFHR
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-RKPY7VD7TP
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lcl7DwsAAAAAL31IyLhKhb9zBi_Ry14_Pt7PYGe
NEXT_PUBLIC_ANALYTICS_ENABLED=true

# API (.env.production)
RECAPTCHA_SECRET_KEY=<from .credential/recaptchar-secret.txt>
GOOGLE_APPLICATION_CREDENTIALS=<path to service account json>
```
