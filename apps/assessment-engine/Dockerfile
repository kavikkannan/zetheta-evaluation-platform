FROM node:20-alpine AS base
WORKDIR /app

# ---- Install dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/assessment-engine/package.json ./apps/assessment-engine/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/frontend-config/package.json ./packages/frontend-config/
COPY packages/ui/package.json ./packages/ui/
RUN corepack enable && pnpm install --no-frozen-lockfile

# ---- Build ----
FROM deps AS builder
COPY . .
# Build shared packages first
RUN pnpm --filter @zetheta/shared-types build || true
RUN pnpm --filter @zetheta/ui build || true
# Build the app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL=http://api-gateway:3001/v1
ARG NEXT_PUBLIC_ASSESSMENT_ENGINE_URL=http://localhost:4002
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_ASSESSMENT_ENGINE_URL=$NEXT_PUBLIC_ASSESSMENT_ENGINE_URL
RUN pnpm --filter @zetheta/assessment-engine build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/assessment-engine/.next/standalone ./
COPY --from=builder /app/apps/assessment-engine/.next/static ./apps/assessment-engine/.next/static

USER nextjs
EXPOSE 4002
ENV PORT 4002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/assessment-engine/server.js"]
