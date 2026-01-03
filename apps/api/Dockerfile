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
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/core ./packages/core
COPY apps/api ./apps/api

# Generate Prisma client
WORKDIR /app/apps/api
RUN pnpm prisma:generate

# Build the application
WORKDIR /app
RUN pnpm --filter @adashield/core build
RUN pnpm --filter @adashield/api build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY --chown=nodejs:nodejs pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package files
COPY --chown=nodejs:nodejs packages/core/package.json ./packages/core/
COPY --chown=nodejs:nodejs apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder --chown=nodejs:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema and generated client
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 3080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3080/api/v1/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Set working directory to app
WORKDIR /app/apps/api

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
