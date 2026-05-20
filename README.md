# LV-Manager

Interne Web-App für SIMA Architecture zur Erstellung, Kalkulation und Verwaltung von
Leistungsverzeichnissen (LV) nach ÖNORM. Läuft als Web-Anwendung auf einem eigenen Server.
Deployment als Multi-Container-Setup über Docker Compose (Projekt `Kalkulationssoftware`):
ein **web**-Container (nginx) liefert das gebaute React-SPA aus und proxyt `/api` intern an
den **api**-Container (Fastify), Daten liegen im **db**-Container (PostgreSQL).
Architektur- und Datenmodell-Details siehe [CLAUDE.md](CLAUDE.md).

## Stack

React 18 + Vite + Tailwind (Web-UI) · Fastify + Prisma (API) · PostgreSQL · pnpm-Monorepo.

## Deployment auf dem Server (Docker Compose)

Voraussetzung: Docker Engine + Docker-Compose-Plugin (v2) auf dem VPS. Das Compose-Projekt
heißt `Kalkulationssoftware` und besteht aus drei Services: **db** (PostgreSQL, nicht nach
außen veröffentlicht), **api** (Fastify, nur intern unter `api:3000`) und **web** (nginx,
liefert das SPA und proxyt `/api` an die API; einziger nach außen offener Port).

### Schnellstart per Script (empfohlen)

```bash
git clone <REPO-URL> Kalkulationssoftware && cd Kalkulationssoftware
./install.sh
```

`install.sh` ist idempotent: Es prüft Docker, erzeugt eine fehlende `.env` aus `.env.example`
mit sicheren Zufallswerten (`JWT_SECRET`, `POSTGRES_PASSWORD`), baut und startet alle Container
(`docker compose up -d --build`) und legt den Erst-Admin an (`db:seed`, mit Retry, da `api`
evtl. noch startet). Eine bereits vorhandene `.env` bleibt unangetastet.

### Manuell

```bash
cp .env.example .env          # Werte anpassen — v.a. POSTGRES_PASSWORD und JWT_SECRET
docker compose up -d --build  # baut api- und web-Image, startet db/api/web
docker compose exec -T api corepack pnpm --filter api db:seed   # Erst-Admin (siehe SEED_ADMIN_* in .env)
```

Beim Start wendet der `api`-Container die DB-Migrationen automatisch an (`prisma migrate deploy`).

Für den ÖNORM-Katalog-Import die `.onlb`-Datei zuerst in den `api`-Container kopieren — sie ist
**nicht** im Image enthalten, der Host-Pfad existiert im Container also nicht:

```bash
docker compose cp ./LB-HB-023-2021.onlb api:/tmp/katalog.onlb   # Datei in den Container kopieren
docker compose exec -T api corepack pnpm --filter api db:import-onlb /tmp/katalog.onlb
```

Alternativ die Datei (oder ihr Verzeichnis) als Volume in den `api`-Service mounten und den
containerinternen Pfad direkt verwenden.

Die Web-UI ist anschließend unter `http://<server>:${HTTP_PORT}` (Default 80) erreichbar.
Für HTTPS einen Reverse-Proxy (nginx/Caddy/Traefik) davorschalten, der auf den web-Port verweist.

### Wichtige Umgebungsvariablen (`.env`)

| Variable | Zweck |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL-Container, zugleich Quelle der `DATABASE_URL` des api-Service |
| `JWT_SECRET` | Signatur der Auth-Tokens, mind. 32 Zeichen zufällig |
| `HTTP_PORT` | Host-Port der Web-UI (Default 80) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Erst-Admin für `db:seed` (Passwort leer = Standard `changeme123`) |

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
