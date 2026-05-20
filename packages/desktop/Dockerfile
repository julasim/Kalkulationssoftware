# ─── Build-Stage ────────────────────────────────────────────────────────────
# Build-Context = Repo-Root
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable

# Workspace-Manifeste + Lockfile zuerst (besseres Layer-Caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/api/package.json       packages/api/package.json
COPY packages/desktop/package.json   packages/desktop/package.json
COPY packages/mcp/package.json       packages/mcp/package.json

RUN pnpm install --no-frozen-lockfile

# Quellcode
COPY . .

# Nur das Frontend-SPA bauen (kein Prisma/API nötig)
RUN pnpm --filter desktop build

# ─── Runtime-Stage ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Statische SPA-Dateien und nginx-Konfiguration übernehmen
COPY --from=builder /app/packages/desktop/dist /usr/share/nginx/html
COPY packages/desktop/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
