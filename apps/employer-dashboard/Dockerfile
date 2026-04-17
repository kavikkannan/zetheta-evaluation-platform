FROM node:20-alpine AS base
WORKDIR /app

# ---- Install dependencies ----
FROM base AS deps
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile

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
RUN pnpm --filter @zetheta/employer-dashboard build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/employer-dashboard/.next/standalone ./
COPY --from=builder /app/apps/employer-dashboard/.next/static ./apps/employer-dashboard/.next/static

USER nextjs
EXPOSE 4003
ENV PORT 4003
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/employer-dashboard/server.js"]
