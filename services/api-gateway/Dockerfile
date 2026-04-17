# ---------- BUILD ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
RUN corepack enable
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm --filter @zetheta/api-gateway... build
# 'pnpm deploy' isolates the package and its prod dependencies into /app/out
RUN pnpm deploy --filter @zetheta/api-gateway --prod /app/out
# Copy the built dist into the deployment folder
RUN cp -r services/api-gateway/dist /app/out/dist

# ---------- PRODUCTION ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy the pnpm-deploy output (symlinks preserved)
COPY --from=builder /app/out ./
COPY prisma ./prisma
RUN npm install -g pnpm prisma

EXPOSE 3001
ENV PORT=3001

CMD ["node", "dist/index.js"]
