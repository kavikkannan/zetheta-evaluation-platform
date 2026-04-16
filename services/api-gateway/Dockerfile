FROM node:20-bullseye

WORKDIR /app

COPY . .

RUN corepack enable \
  && pnpm install --no-frozen-lockfile \
  && pnpm exec prisma generate

EXPOSE 3001

CMD ["sh", "-c", "pnpm --filter @zetheta/api-gateway dev"]
