# ADAShield - Technology Stack

## Project Type

**SaaS Web Application** - Cloud-hosted accessibility testing platform with:
- REST API backend
- Web dashboard frontend (responsive, mobile-friendly)
- Background job processing for scanning
- AI integration for enhanced analysis

### Platform Decision

| Platform | Status | Rationale |
|----------|--------|-----------|
| **Web (Desktop)** | Primary | Core use case - detailed scanning & reports |
| **Web (Mobile)** | Responsive | Quick status checks, notifications |
| **Native Mobile App** | Not Planned | No market demand, competitors don't have, delays MVP |
| **PWA** | Optional (Future) | "App-like" experience without app store |

**Key Decision**: Web-only with responsive design. Users scan websites at their desk; detailed WCAG reports require large screens. No competitor has a mobile app.

## Core Technologies

### Primary Language

| Component | Technology | Version |
|-----------|------------|---------|
| **Backend** | Node.js | 20 LTS |
| **Language** | TypeScript | 5.x (strict mode) |
| **Frontend** | TypeScript/React | 18.x |

### Runtime & Build

| Tool | Purpose |
|------|---------|
| **Node.js 20 LTS** | Backend runtime |
| **pnpm** | Package manager (faster, disk-efficient) |
| **tsx** | TypeScript execution for development |
| **esbuild** | Fast bundling for production |

## Backend Stack

### API Framework

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **Fastify** | REST API framework | Faster than Express, built-in validation, TypeScript-first |
| **@fastify/cors** | CORS handling | Security |
| **@fastify/helmet** | Security headers | Protection |
| **@fastify/rate-limit** | Rate limiting | Abuse prevention |
| **@fastify/swagger** | API documentation | OpenAPI spec generation |

### Database & Storage

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **PostgreSQL 15+** | Primary database | Reliable, JSON support, full-text search |
| **Prisma** | ORM | Type-safe, migrations, excellent DX |
| **Redis 7+** | Cache & queue broker | Fast, BullMQ compatible |
| **AWS S3** | File storage | Reports, downloaded sites, assets |

### Queue & Background Jobs

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **BullMQ** | Job queue | Reliable, Redis-based, good monitoring |
| **Bull Board** | Queue monitoring | Visual dashboard for debugging |

### Accessibility Testing Engine

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| **axe-core** | Primary WCAG testing | Industry standard, Deque-backed, 57% issue detection |
| **@axe-core/playwright** | Playwright integration | Official integration |
| **Playwright** | Browser automation | Fast, reliable, multi-browser |
| **Chromium** | Headless browser | Consistent rendering |

### AI Integration

| Provider | Model | Purpose | Priority |
|----------|-------|---------|----------|
| **OpenAI** | GPT-4o, GPT-4 Vision | Primary AI analysis | 1 (Best accuracy) |
| **Google** | Gemini 1.5 Pro | Fallback/cost-effective | 2 (Backup) |
| **DeepSeek** | DeepSeek V3 | Budget/high-volume | 3 (Cost savings) |

**AI SDK/Libraries:**

| Library | Purpose |
|---------|---------|
| **openai** | OpenAI API client |
| **@google/generative-ai** | Gemini API client |
| **langchain** | AI orchestration (optional, for complex chains) |

### Site Download & Analysis

| Technology | Purpose |
|------------|---------|
| **got** or **axios** | HTTP client for downloading |
| **cheerio** | HTML parsing |
| **puppeteer-cluster** | Parallel page rendering |
| **tmp** | Temporary file management |
| **Claude Code SDK** | Agentic analysis (Phase 3) |

## Frontend Stack

### Framework & Libraries

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Next.js 14** | Full-stack React framework |
| **TypeScript** | Type safety |
| **TailwindCSS** | Styling |
| **shadcn/ui** | UI components |
| **React Query** | Server state management |
| **Zustand** | Client state management |
| **React Hook Form** | Form handling |
| **Zod** | Validation (shared with backend) |

### Visualization

| Technology | Purpose |
|------------|---------|
| **Recharts** | Charts for dashboard |
| **react-pdf** | PDF report viewing |

## Development Environment

### Code Quality Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **ESLint** | Linting | @typescript-eslint, import plugin |
| **Prettier** | Formatting | 4 spaces, 140 chars |
| **TypeScript** | Type checking | Strict mode |
| **Vitest** | Unit testing | Fast, native ESM |
| **Playwright Test** | E2E testing | Browser automation |

### Git Workflow

| Aspect | Standard |
|--------|----------|
| **Commits** | Conventional Commits |
| **Branches** | feature/, bugfix/, hotfix/, release/ |
| **Pre-commit** | husky + lint-staged |
| **PR Template** | Required for all changes |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Docker** | Local development environment |
| **Docker Compose** | Multi-service orchestration |
| **pnpm workspaces** | Monorepo management |

## Infrastructure (AWS)

### Compute

| Service | Purpose |
|---------|---------|
| **ECS Fargate** | Container orchestration |
| **ECR** | Container registry |
| **Lambda** | Serverless functions (webhooks, scheduled tasks) |

### Database & Storage

| Service | Purpose |
|---------|---------|
| **RDS PostgreSQL** | Primary database |
| **ElastiCache Redis** | Cache and queue |
| **S3** | File storage (reports, assets) |

### Networking & Security

| Service | Purpose |
|---------|---------|
| **CloudFront** | CDN for frontend |
| **ALB** | Load balancer |
| **Route 53** | DNS |
| **ACM** | SSL certificates |
| **Secrets Manager** | API keys, credentials |
| **WAF** | Web application firewall |

### Monitoring & Logging

| Service | Purpose |
|---------|---------|
| **CloudWatch** | Logs, metrics, alarms |
| **X-Ray** | Distributed tracing |
| **Sentry** | Error tracking |

## Technical Requirements & Constraints

### Performance Requirements

| Metric | Target |
|--------|--------|
| **API Response Time** | < 200ms (p95) |
| **Single Page Scan** | < 30 seconds |
| **Multi-Page Scan (10 pages)** | < 5 minutes |
| **Report Generation** | < 10 seconds |
| **Dashboard Load Time** | < 2 seconds |
| **Concurrent Scans** | 100+ simultaneous |

### Scalability Requirements

| Metric | Target |
|--------|--------|
| **Pages Scanned/Month** | 1M+ |
| **Concurrent Users** | 1,000+ |
| **Storage (Reports)** | 10TB+ |
| **Uptime** | 99.9% |

### Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Authentication** | JWT + refresh tokens |
| **Authorization** | RBAC (role-based access control) |
| **Data Encryption** | TLS 1.3, AES-256 at rest |
| **API Security** | Rate limiting, input validation |
| **Secrets Management** | AWS Secrets Manager |
| **Audit Logging** | All sensitive operations logged |

### Compliance

| Standard | Status |
|----------|--------|
| **GDPR** | Required (EU customers) |
| **SOC 2** | Future (enterprise requirement) |
| **WCAG 2.2 AA** | Required (our own product!) |

## Technical Decisions & Rationale

### Decision Log

| Decision | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| **Backend Language** | Node.js/TypeScript | Native axe-core integration, Playwright performance | Python (good AI, but subprocess overhead), Go (fast, but no axe-core) |
| **API Framework** | Fastify | Faster than Express, better TypeScript support | Express (more plugins), NestJS (heavier) |
| **Database** | PostgreSQL | JSON support, reliability, Prisma compatibility | MongoDB (less structured), MySQL (less features) |
| **Queue** | BullMQ | Redis-based, reliable, good DX | Celery (Python), RabbitMQ (more complex) |
| **Browser Automation** | Playwright | Faster than Puppeteer, better API | Puppeteer (older), Selenium (slower) |
| **AI Primary** | OpenAI GPT-4o | Best accuracy for vision + text | Claude (API limits), Gemini (slightly less accurate) |
| **Frontend Framework** | Next.js | SSR, API routes, great DX | Vite+React (simpler), Remix (newer) |
| **Cloud Provider** | AWS | Most mature, best security | GCP (good AI), Azure (enterprise) |

### Architecture Decisions

**1. Monorepo Structure**
- Single repository for API, dashboard, shared code
- Easier refactoring, consistent versioning
- pnpm workspaces for package management

**2. Queue-Based Scanning**
- Scans run as background jobs, not in request cycle
- Enables long-running scans without timeout
- Horizontal scaling of workers

**3. Multi-Provider AI**
- Abstract AI provider behind interface
- Easy to switch/fallback between providers
- Cost optimization based on usage tier

**4. Downloaded Site Analysis**
- Store sites temporarily in S3
- Enable deep analysis without repeated fetching
- Support for agentic CLI tools

## Known Limitations

| Limitation | Impact | Future Solution |
|------------|--------|-----------------|
| **Automated detection ~57%** | Some issues require manual review | AI enhancement targets 75-85% |
| **JavaScript-heavy SPAs** | May miss dynamically loaded content | Wait strategies, interaction simulation |
| **Login-protected pages** | Cannot scan without credentials | Session/cookie injection feature |
| **Rate limiting by sites** | Some sites block automated scanning | Proxy rotation, respectful delays |
| **PDF accessibility** | Not in MVP scope | Future: PDF/UA validation |

## Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev              # Start all services
pnpm dev:api          # API only
pnpm dev:web          # Frontend only
pnpm dev:worker       # Queue workers

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:e2e         # E2E tests only
pnpm test:coverage    # With coverage report

# Code Quality
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm typecheck        # TypeScript

# Build
pnpm build            # Production build
pnpm build:api        # API only
pnpm build:web        # Frontend only

# Database
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed data
pnpm db:studio        # Prisma Studio
```

---

*Last Updated: December 2024*
*Version: 1.0*
