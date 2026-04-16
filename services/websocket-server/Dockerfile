FROM node:20-bullseye

WORKDIR /app

COPY . .

RUN corepack enable \
  && pnpm install --no-frozen-lockfile

EXPOSE 3003

CMD ["sh", "-c", "pnpm --filter @zetheta/websocket-server dev"]
