# ── Stage 1: Dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY web/package.json ./web/

# Install all dependencies
RUN npm ci --workspace=web --include-workspace-root --ignore-scripts

# ── Stage 2: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules

# Copy source
COPY packages/core/ ./packages/core/
COPY web/ ./web/

# Build Next.js (standalone mode)
WORKDIR /app/web
RUN npm run build

# ── Stage 3: Production ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "web/server.js"]
