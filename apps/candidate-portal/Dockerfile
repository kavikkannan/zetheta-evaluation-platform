FROM node:20-bullseye

WORKDIR /app

COPY . .

RUN corepack enable \
  && pnpm install --no-frozen-lockfile

EXPOSE 4001

CMD ["sh", "-c", "pnpm --filter @zetheta/candidate-portal dev"]
