FROM node:20-bullseye

WORKDIR /app

COPY . .

RUN corepack enable \
  && pnpm install --no-frozen-lockfile \
  && pnpm exec prisma generate

EXPOSE 3002

CMD ["sh", "-c", "pnpm --filter @zetheta/auth-service dev"]
