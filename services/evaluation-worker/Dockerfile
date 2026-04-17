# ---------- BUILD ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
RUN corepack enable
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm --filter @zetheta/evaluation-worker... build
RUN pnpm deploy --filter @zetheta/evaluation-worker --prod /app/out
RUN cp -r services/evaluation-worker/dist /app/out/dist
# ---------- PRODUCTION ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy the pnpm-deploy output (symlinks preserved)
COPY --from=builder /app/out ./

CMD ["node", "dist/index.js"]
