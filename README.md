# LV-Manager

Interne Web-App für SIMA Architecture zur Erstellung, Kalkulation und Verwaltung von
Leistungsverzeichnissen (LV) nach ÖNORM. Läuft als Web-Anwendung auf einem eigenen Server:
ein Fastify-Prozess liefert die REST-API **und** das gebaute React-SPA aus, PostgreSQL als
Datenbank. Architektur- und Datenmodell-Details siehe [CLAUDE.md](CLAUDE.md).

## Stack

React 18 + Vite + Tailwind (Web-UI) · Fastify + Prisma (API) · PostgreSQL · pnpm-Monorepo.

## Deployment auf dem Server (Docker)

Voraussetzung: Docker + Docker Compose auf dem VPS.

```bash
git clone <REPO-URL> lv-manager && cd lv-manager
cp .env.example .env          # Werte anpassen — v.a. POSTGRES_PASSWORD und JWT_SECRET
docker compose up -d --build  # baut App-Image, startet Postgres + App
```

Beim Start wendet der App-Container die DB-Migrationen automatisch an (`prisma migrate deploy`).
Danach den Erst-Admin anlegen und den ÖNORM-Katalog importieren:

```bash
docker compose exec app pnpm db:seed                 # Admin-User (siehe SEED_ADMIN_* in .env)
docker compose exec app pnpm --filter api db:import-onlb /pfad/zur/LB-HB-023-2021.onlb
```

Die App ist anschließend unter `http://<server>:${APP_PORT}` (Default 3000) erreichbar.
Für HTTPS einen Reverse-Proxy (nginx/Caddy/Traefik) davorschalten, der auf den App-Port verweist.

### Wichtige Umgebungsvariablen (`.env`)

| Variable | Zweck |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL-Container |
| `JWT_SECRET` | Signatur der Auth-Tokens, mind. 32 Zeichen zufällig |
| `APP_PORT` | Host-Port der App (Default 3000) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Erst-Admin für `db:seed` |

## Lokale Entwicklung

Voraussetzung: Node 20+, pnpm (`corepack enable`), eine erreichbare PostgreSQL-Instanz.

```bash
pnpm install
cp packages/api/.env.example packages/api/.env   # DATABASE_URL + JWT_SECRET setzen
pnpm db:deploy        # Migrationen anwenden
pnpm db:seed          # Admin-User
pnpm dev:api          # API auf :3000
pnpm dev:web          # Vite-Dev-Server auf :5173 (proxyt /api -> :3000)
```

Frontend im Browser unter `http://localhost:5173`.

### Nützliche Skripte

| Befehl | Wirkung |
|---|---|
| `pnpm db:migrate` | Neue Migration erstellen (Schema-Änderung, Dev) |
| `pnpm db:deploy` | Bestehende Migrationen anwenden (Prod) |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:generate` | Prisma-Client neu generieren |
| `pnpm build` | Web-SPA + API bauen |

## ÖNORM-Katalog (ONLB)

Der Import liest LB-HB/LB-H-Leistungsbücher im Format ÖNORM A2063:2021 (`.onlb`, XML) ein und
befüllt die Tabelle `KatalogPosition`. Aufruf siehe oben (`db:import-onlb`). Der Import ist
idempotent pro Quelle.
