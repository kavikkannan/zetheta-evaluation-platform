FROM node:20-bullseye

WORKDIR /app

COPY . .

RUN corepack enable \
  && pnpm install --no-frozen-lockfile \
  && pnpm exec prisma generate

# No port to expose for a worker, but let's keep it healthy
CMD ["sh", "-c", "pnpm --filter @zetheta/evaluation-worker dev"]
