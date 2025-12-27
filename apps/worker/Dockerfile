# ============================================
# Build Stage
# ============================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY turbo.json ./

# Copy package files
COPY packages/core/package.json ./packages/core/
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/

# Copy Prisma schema (shared with API)
COPY apps/api/prisma ./apps/api/prisma

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client (uses schema from API)
RUN cd apps/api && npx prisma generate

# Copy source code
COPY packages/core ./packages/core
COPY apps/worker ./apps/worker

# Build the application
RUN pnpm --filter @adashield/core build
RUN pnpm --filter @adashield/worker build

# ============================================
# Production Stage - Using Playwright image
# ============================================
FROM mcr.microsoft.com/playwright:v1.41.0-jammy AS runner

# Install Node.js 20 (Playwright image comes with Node.js but we want specific version)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Create app user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nodejs

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY --chown=nodejs:nodejs pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package files
COPY --chown=nodejs:nodejs packages/core/package.json ./packages/core/
COPY --chown=nodejs:nodejs apps/worker/package.json ./apps/worker/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder --chown=nodejs:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker/dist ./apps/worker/dist

# Install Playwright browsers (already in base image, but ensuring dependencies are correct)
RUN npx playwright install-deps

# Create directory for browser cache
RUN mkdir -p /home/nodejs/.cache && chown -R nodejs:nodejs /home/nodejs

# Switch to nodejs user
USER nodejs

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Set working directory to app
WORKDIR /app/apps/worker

# Start the worker
CMD ["node", "dist/index.js"]
