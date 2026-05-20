# ─── Build-Stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable

# Manifeste zuerst (besseres Layer-Caching)
COPY package.json pnpm-workspace.yaml tsconfig.json ./
COPY packages/api/package.json       packages/api/package.json
COPY packages/desktop/package.json   packages/desktop/package.json
COPY packages/mcp/package.json       packages/mcp/package.json

RUN pnpm install --no-frozen-lockfile

# Quellcode
COPY . .

# Prisma-Client generieren, dann Web-SPA + API bauen
RUN pnpm --filter api db:generate
RUN pnpm --filter desktop build
RUN pnpm --filter api build

# ─── Runtime-Stage ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl wird vom Prisma-Query-Engine benötigt
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Komplettes gebautes Projekt übernehmen (node_modules inkl. generiertem Prisma-Client)
COPY --from=builder /app ./

EXPOSE 3000

# Beim Start: Migrationen anwenden, dann API (serviert auch das SPA)
CMD ["sh", "-c", "pnpm --filter api db:deploy && node packages/api/dist/index.js"]
