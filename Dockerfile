FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Native build tools are required by some transport dependencies.
RUN apk add --no-cache python3 make g++

# This repository uses pnpm-lock.yaml, not package-lock.json.
COPY package.json pnpm-lock.yaml ./

RUN corepack enable \
    && corepack prepare pnpm@10.18.3 --activate \
    && pnpm install --frozen-lockfile --prod

COPY . .

EXPOSE 8080
CMD ["pnpm", "start"]
