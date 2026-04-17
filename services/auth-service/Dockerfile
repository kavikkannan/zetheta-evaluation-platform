# ---------- BUILD ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
RUN corepack enable
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm --filter @zetheta/auth-service... build
RUN pnpm deploy --filter @zetheta/auth-service --prod /app/out
RUN cp -r services/auth-service/dist /app/out/dist
# ---------- PRODUCTION ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy the pnpm-deploy output (symlinks preserved)
COPY --from=builder /app/out ./

EXPOSE 3002
ENV PORT=3002

CMD ["node", "dist/index.js"]
