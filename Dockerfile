FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS dev

ENV NODE_ENV=development
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "dev"]

FROM base AS build
RUN pnpm --filter web build

FROM node:20-bookworm-slim AS prod

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=build /app /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
