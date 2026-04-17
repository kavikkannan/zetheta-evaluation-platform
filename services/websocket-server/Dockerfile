# ---------- BUILD ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
RUN corepack enable
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zetheta/websocket-server... build
RUN pnpm deploy --filter @zetheta/websocket-server --prod /app/out
RUN cp -r services/websocket-server/dist /app/out/dist
# ---------- PRODUCTION ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy the pnpm-deploy output (symlinks preserved)
COPY --from=builder /app/out ./

EXPOSE 3003
ENV PORT=3003

CMD ["node", "dist/index.js"]
