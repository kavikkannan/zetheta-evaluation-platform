FROM node:20-alpine

WORKDIR /app

COPY . .

RUN corepack enable

EXPOSE 3010

CMD ["sh", "-c", "echo '@zetheta/evaluation-worker container placeholder started on port 3010' && sleep infinity"]
