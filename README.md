# ADAShield - ADA/WCAG Compliance Testing Tool

[![CI](https://github.com/YOUR_USERNAME/ada-wacg-compliance/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/ada-wacg-compliance/actions/workflows/ci.yml)

A comprehensive web accessibility testing solution targeting SMBs, e-commerce sites, and agencies. Built with honesty and transparency, ADAShield provides realistic expectations about automated accessibility testing.

## Project Status

This project is in active development. The monorepo structure is set up with API, Worker, and Web applications.

## Architecture

- **API** (`apps/api`): Fastify-based REST API server
- **Worker** (`apps/worker`): BullMQ worker with Playwright for accessibility scans
- **Web** (`apps/web`): Next.js frontend application
- **Core** (`packages/core`): Shared types, constants, and utilities

### Tech Stack

- **Backend**: Node.js 20, Fastify, Prisma ORM
- **Database**: PostgreSQL 16
- **Queue**: Redis + BullMQ
- **Storage**: S3 (MinIO for local dev)
- **Testing**: Playwright, axe-core, Vitest
- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Monorepo**: pnpm workspaces, Turbo

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (for local development)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ada-wacg-compliance
pnpm install
```

### 2. Environment Setup

Copy the example environment file and update as needed:

```bash
cp .env.example .env
```

### 3. Start with Docker Compose

#### Development Mode (Recommended for Local Development)

```bash
# Start all services with hot reload
docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The development setup includes:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- MinIO on `localhost:9000` (API) and `localhost:9001` (Console)
- API on `http://localhost:3080`
- Web on `http://localhost:3000`

**Development features:**
- Hot reload for all services
- Source code mounted as volumes
- Debug logging enabled
- Non-headless browser mode for worker

#### Production Mode

```bash
# Build and start production containers
docker-compose -f docker-compose.yml up --build

# Or run in background
docker-compose -f docker-compose.yml up -d --build
```

### 4. Database Setup

After starting the services, initialize the database:

```bash
# Run migrations
docker-compose exec api pnpm prisma:migrate:deploy

# (Optional) Seed database with sample data
docker-compose exec api pnpm prisma:seed
```

### 5. Access Services

- **Web Frontend**: http://localhost:3000
- **API Server**: http://localhost:3080
- **API Health**: http://localhost:3080/api/v1/health
- **BullMQ Dashboard**: http://localhost:3080/api/v1/admin/queues
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## Local Development (Without Docker)

If you prefer to run services locally without Docker:

### 1. Start Infrastructure Services

```bash
# Start only PostgreSQL, Redis, and MinIO
docker-compose up postgres redis minio
```

### 2. Run Applications Locally

```bash
# Terminal 1 - API
cd apps/api
pnpm dev

# Terminal 2 - Worker
cd apps/worker
pnpm dev

# Terminal 3 - Web
cd apps/web
pnpm dev
```

## Available Scripts

### Root Level

```bash
pnpm dev              # Start all apps in development mode
pnpm build            # Build all apps
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests
pnpm test:integration # Run integration tests
pnpm lint             # Lint all packages
pnpm typecheck        # Type check all packages
pnpm format           # Format code with Prettier
pnpm clean            # Clean all build artifacts
```

### API (`apps/api`)

```bash
pnpm dev                    # Start dev server with hot reload
pnpm build                  # Build for production
pnpm start                  # Start production server
pnpm test                   # Run tests
pnpm prisma:generate        # Generate Prisma client
pnpm prisma:migrate         # Create and apply migration
pnpm prisma:migrate:deploy  # Apply migrations (production)
pnpm prisma:studio          # Open Prisma Studio
pnpm prisma:seed            # Seed database
```

### Worker (`apps/worker`)

```bash
pnpm dev    # Start worker with hot reload
pnpm build  # Build for production
pnpm start  # Start production worker
pnpm test   # Run tests
```

### Web (`apps/web`)

```bash
pnpm dev    # Start Next.js dev server
pnpm build  # Build for production
pnpm start  # Start production server
pnpm lint   # Run ESLint
```

## Docker Commands Reference

### Build Commands

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build api
docker-compose build worker
docker-compose build web

# Build without cache
docker-compose build --no-cache
```

### Service Management

```bash
# Start services
docker-compose up                    # Foreground
docker-compose up -d                 # Background
docker-compose up api worker         # Specific services

# Stop services
docker-compose stop                  # Stop all
docker-compose stop api              # Stop specific service

# Restart services
docker-compose restart               # Restart all
docker-compose restart api           # Restart specific service

# Remove services
docker-compose down                  # Stop and remove containers
docker-compose down -v               # Also remove volumes
```

### Logs and Debugging

```bash
# View logs
docker-compose logs                  # All services
docker-compose logs -f               # Follow logs
docker-compose logs -f api           # Specific service
docker-compose logs --tail=100 api   # Last 100 lines

# Execute commands in containers
docker-compose exec api sh           # Shell access
docker-compose exec api pnpm prisma:studio
docker-compose exec postgres psql -U postgres -d adashield

# View container status
docker-compose ps
docker-compose top
```

### Database Management

```bash
# Create migration
docker-compose exec api pnpm prisma:migrate

# Apply migrations
docker-compose exec api pnpm prisma:migrate:deploy

# Reset database (WARNING: destroys data)
docker-compose exec api pnpm prisma:reset

# Access PostgreSQL
docker-compose exec postgres psql -U postgres -d adashield

# Backup database
docker-compose exec postgres pg_dump -U postgres adashield > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U postgres adashield
```

### MinIO Management

```bash
# Access MinIO Console
# Open http://localhost:9001 in browser
# Login: minioadmin / minioadmin

# Create bucket using mc (MinIO Client)
docker run --rm --network adashield_adashield-network \
  minio/mc alias set local http://minio:9000 minioadmin minioadmin
docker run --rm --network adashield_adashield-network \
  minio/mc mb local/adashield
```

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

### Database
- `DATABASE_URL`: PostgreSQL connection string
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: Database credentials

### Redis
- `REDIS_URL`: Redis connection string

### S3/MinIO
- `S3_ENDPOINT`: S3 endpoint URL
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`: S3 credentials
- `S3_BUCKET`: Bucket name

### API
- `API_PORT`: API server port (default: 3080)
- `COOKIE_SECRET`: Session cookie secret
- `CORS_ORIGIN`: Allowed CORS origin

### Web
- `WEB_PORT`: Web server port (default: 3000)
- `NEXT_PUBLIC_API_URL`: API URL for frontend

### Worker
- `WORKER_CONCURRENCY`: Number of concurrent jobs
- `PLAYWRIGHT_HEADLESS`: Run browser in headless mode

## Troubleshooting

### Port Conflicts

If you have port conflicts, update the ports in `.env`:

```bash
API_PORT=3002
WEB_PORT=3080
POSTGRES_PORT=5433
REDIS_PORT=6380
MINIO_PORT=9001
MINIO_CONSOLE_PORT=9002
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U postgres
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker-compose logs -f worker

# Check Redis connection
docker-compose exec redis redis-cli ping

# Verify queue in BullMQ Dashboard
# http://localhost:3080/api/v1/admin/queues
```

### Clean Restart

```bash
# Stop everything and remove volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Rebuild and start fresh
docker-compose up --build
```

## Production Deployment

### Security Checklist

Before deploying to production:

1. Change all default passwords in `.env`
2. Generate strong `COOKIE_SECRET`: `openssl rand -base64 32`
3. Use strong `POSTGRES_PASSWORD`
4. Use strong `MINIO_ROOT_PASSWORD`
5. Set proper `CORS_ORIGIN` to your domain
6. Configure proper `NEXT_PUBLIC_API_URL`
7. Enable SSL/TLS for all services
8. Review and update security headers in API
9. Set up proper backup strategy for database
10. Configure monitoring and logging

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.yml build --no-cache

# Start in production mode
NODE_ENV=production docker-compose -f docker-compose.yml up -d

# Apply database migrations
docker-compose exec api pnpm prisma:migrate:deploy
```

## Project Goals

Build a testing tool (NOT an overlay/widget) that:
- Provides honest, transparent accessibility testing
- Detects realistic percentage of WCAG issues (~30% via automation)
- Integrates with CI/CD pipelines
- Supports WCAG 2.0, 2.1, 2.2 (Levels A, AA, AAA)
- Complies with ADA, EN 301 549, AODA, and other standards

## Target Markets

1. USA (largest market, most lawsuits)
2. EU (27 countries, EAA penalties up to €3M)
3. UK (Equality Act 2010)
4. Canada (AODA, fines up to CAD 100k/day)

## License

UNLICENSED - Proprietary
