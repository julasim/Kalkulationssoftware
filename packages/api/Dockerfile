# syntax=docker/dockerfile:1
# API-Image für LV-Manager — baut NUR die Fastify-REST-API (kein desktop).
# Build-Context = Repo-Root, daher beginnen alle Pfade mit "packages/...".

# ─── Build-Stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable
# openssl im Builder, damit `prisma generate` die OpenSSL-Version (3.0) korrekt
# erkennt und die passende Query-Engine erzeugt.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Manifeste + Lockfile zuerst (besseres Layer-Caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/api/package.json       packages/api/package.json
COPY packages/desktop/package.json   packages/desktop/package.json
COPY packages/mcp/package.json       packages/mcp/package.json

RUN pnpm install --no-frozen-lockfile

# Quellcode
COPY . .

# Prisma-Client generieren, dann nur die API bauen (desktop wird NICHT gebaut)
RUN pnpm --filter api db:generate
RUN pnpm --filter api build

# ─── Runtime-Stage ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl wird vom Prisma-Query-Engine benötigt
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Komplettes gebautes Projekt übernehmen — inkl. node_modules mit generiertem
# Prisma-Client sowie prisma-CLI und tsx (für db:seed / db:import-onlb per
# `docker compose exec`).
COPY --from=builder /app ./

EXPOSE 3000

# Beim Start: Migrationen anwenden, dann API starten.
# Ohne packages/desktop/dist läuft die API korrekt im "nur API"-Modus.
CMD ["sh", "-c", "corepack pnpm --filter api db:deploy && node packages/api/dist/index.js"]
