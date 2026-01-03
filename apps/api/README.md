# @adashield/api

ADAShield API Server - Fastify-based REST API for accessibility testing.

## Overview

This is the API server for the ADAShield accessibility testing tool. Built with Fastify for high performance and low overhead.

## Features

- **Fastify Framework**: Fast and low overhead web framework
- **Type Safety**: Full TypeScript support with Zod validation
- **Security**: Helmet for security headers, CORS configuration
- **Environment Config**: Validated environment variables with defaults
- **Health Checks**: Built-in health check endpoint
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals

## Getting Started

### Installation

```bash
# From the monorepo root
pnpm install
```

### Development

```bash
# Start development server with hot reload
pnpm dev

# From monorepo root
pnpm --filter @adashield/api dev
```

### Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

### Testing

```bash
# Run all tests
pnpm test

# Run unit tests
pnpm test:unit

# Run integration tests
pnpm test:integration

# Watch mode
pnpm test:watch
```

## Database Setup

### Quick Start with Docker

The easiest way to set up the development database:

```bash
# Start PostgreSQL, run migrations, and seed data
pnpm db:setup

# Or do it step by step:
docker-compose up -d              # Start PostgreSQL
pnpm prisma:migrate              # Run migrations
pnpm prisma:seed                 # Seed development data
```

### Stop Database

```bash
pnpm db:down
```

### DATABASE_URL Format

The `DATABASE_URL` environment variable uses the following format:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
```

**Example** (from `.env.example`):
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/adashield?schema=public
```

**Important Notes**:
- The docker-compose.yml uses port **5433** (not 5432) to avoid conflicts
- For production, use a secure password and update the connection string
- In Prisma 7.x, the connection string is configured in `prisma/prisma.config.ts`

### Database Commands

```bash
# Generate Prisma Client after schema changes
pnpm prisma:generate

# Create a new migration
pnpm prisma:migrate

# Deploy migrations (production)
pnpm prisma:migrate:deploy

# Open Prisma Studio (database GUI)
pnpm prisma:studio

# Push schema changes without migration (dev only)
pnpm prisma:push

# Reset database (WARNING: destroys data)
pnpm prisma:reset

# Seed database with development data
pnpm prisma:seed
```

### Seed Data

The seed script creates sample development data:
- 3 Guest Sessions (active, expired, anonymized)
- 5 Scans (PENDING, RUNNING, COMPLETED x2, FAILED)
- 2 Scan Results with detailed metrics
- 8 Issues covering different WCAG criteria and impact levels
- 2 Reports (PDF and JSON formats)

## Configuration

Create a `.env` file in the `apps/api` directory (see `.env.example`):

```env
NODE_ENV=development
PORT=3080
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
API_PREFIX=/api/v1
COOKIE_SECRET=your-secret-key-here
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/adashield?schema=public
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production/test) | `development` |
| `PORT` | Server port | `3080` |
| `HOST` | Server host | `0.0.0.0` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `LOG_LEVEL` | Logging level (fatal/error/warn/info/debug/trace) | `info` |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `COOKIE_SECRET` | Secret for cookie signing | (required in production) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5433/adashield?schema=public` |

## API Endpoints

### Health Check

```bash
GET /api/v1/health
```

Returns server health status:

```json
{
  "status": "ok",
  "timestamp": "2025-12-25T14:55:06.221Z",
  "environment": "development",
  "version": "0.1.0"
}
```

### API Root

```bash
GET /
```

Returns API information:

```json
{
  "name": "ADAShield API",
  "version": "0.1.0",
  "description": "Accessibility testing API",
  "docs": "/api/v1/docs"
}
```

## Project Structure

```
apps/api/
├── src/
│   ├── config/
│   │   └── env.ts           # Environment configuration
│   └── index.ts             # Server entry point
├── .env.example             # Example environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## Next Steps

The API structure is ready for adding:

1. **Scan Module** - Accessibility scan endpoints
2. **Result Module** - Scan result storage and retrieval
3. **Report Module** - Report generation and export

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 4.x
- **Language**: TypeScript 5.x
- **Validation**: Zod
- **Testing**: Vitest
- **Build**: tsx (development), tsc (production)

## License

UNLICENSED - Proprietary
