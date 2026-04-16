FROM node:20-bullseye

WORKDIR /app

COPY . .

RUN corepack enable \
  && pnpm install --no-frozen-lockfile

EXPOSE 4002

CMD ["sh", "-c", "pnpm --filter @zetheta/assessment-engine dev"]
