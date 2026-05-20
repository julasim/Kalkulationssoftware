# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Befehle

Alle Befehle vom Repo-Root (pnpm Workspaces):

```bash
pnpm install                  # einmalig, installiert alle Packages
pnpm db:generate              # Prisma Client generieren (NÖTIG vor erstem build/dev)

pnpm dev:api                  # Fastify API (tsx watch, Port 3000) — serviert auch /api
pnpm dev:web                  # Vite Dev-Server (Port 5173, proxyt /api -> :3000)
pnpm dev:mcp                  # MCP Server (stdio)

pnpm build                    # baut Web-SPA + API (vite / tsc)
pnpm db:deploy                # prisma migrate deploy (Migrationen anwenden, Prod)
pnpm db:migrate               # prisma migrate dev (neue Migration, Dev)
pnpm db:seed                  # Admin-User anlegen
pnpm db:studio                # Prisma Studio
pnpm --filter api db:import-onlb <datei.onlb>   # ÖNORM-Katalog importieren
```

Deployment: `docker compose up -d --build` (Postgres + App-Container). Details in `README.md`.

**Wichtig — lokaler Build:** `pnpm build` ruft intern `pnpm` auf; liegt pnpm nicht im PATH (z. B. nur via corepack aktiviert), die Pakete einzeln bauen: `corepack pnpm --filter desktop build` bzw. `--filter api build`. Im Docker-Build ist pnpm via `corepack enable` vorhanden.

Es gibt **kein Test-Setup** (kein Vitest/Jest). Verifikation läuft über `tsc --noEmit` (strict) und den Production-Build.

## Architektur-Hinweis (Web statt Tauri)

Statt der ursprünglich geplanten Tauri-Desktop-App ist dies eine **Web-App** (kein Tauri, kein `src-tauri/`). Alle API-Routen liegen unter dem `/api`-Prefix (z. B. `/api/auth/login`).

**Deployment (Produktion):** Multi-Container via Docker Compose, Projekt `Kalkulationssoftware` — `web` (nginx, liefert SPA + proxyt `/api` an `api:3000`) ist der einzige Service am externen Edge-Proxy-Netz (`PROXY_NETWORK`, Default `proxy`; Alias `kalkulationssoftware`); `api` (Fastify) und `db` (PostgreSQL) bleiben rein privat, kein Host-Port. Ein zentraler Caddy-Edge-Proxy macht TLS + Domain-Routing. Im API-Image fehlt `packages/desktop/dist`, daher läuft die API dort im „nur /api"-Modus — das `@fastify/static`-SPA-Serving in `app.ts` greift nur, wenn `dist` vorhanden ist (z. B. lokal).

**Lokal:** `pnpm dev:web` (Vite :5173, proxyt `/api`) + `pnpm dev:api` (:3000).

## Implementierungsstand

Vertikaler Durchstich (M0–M4) steht: **Login → Projekt → LV → Position aus ÖNORM-Katalog → Kalkulation → Summen**.

- **API** (`packages/api/src`): modular — `app.ts` baut die Instanz, `plugins/` (prisma, auth), `routes/` (health, auth, katalog, projekte, lvs, kalkulation) unter `/api`, `services/kalkulation.ts` (reine Engine). Auth = bcrypt + JWT.
- **Prisma**: Baseline-Migration vorhanden (`prisma/migrations/0_init`). `KatalogPosition` um ÖNORM-Hierarchie erweitert. Seed-Admin in `prisma/seed.ts`.
- **Katalog-Import** (`prisma/import-onlb.ts`): parst ÖNORM A2063:2021 `.onlb` (XML), `--dry` für Verifikation ohne DB. Gegen LB-HB-023: ~19.700 Positionen.
- **Web** (`packages/desktop/src`): Auth-Context (`lib/auth`), Seiten ProjekteListe/ProjektDetail/LVEditor/Kalkulation/Katalog, `KatalogPicker`-Modal, `lib/api` (Token in localStorage).
- **MCP** (`packages/mcp/src/index.ts`): read-Tools + `create_angebot`, direkter PrismaClient.

**Noch offen:** PDF/Excel-Export, LV-Versionierung, restliche CRUD-Breite (Angebote-Seite, Einstellungen).

## Stolperfallen

- **Prisma Client vor Build generieren**: nach `pnpm install` bzw. Schema-Änderung zuerst `pnpm db:generate`, sonst Typfehler.
- **Top-Level `await`** in api/mcp (tsconfig: `module: NodeNext`/`ESNext`, `target: ES2022`). Beibehalten.
- **Decimal-Felder**: Prisma liefert `Decimal` (JSON-serialisiert als **String**). Vor Rechnen per `Number(...)` konvertieren (Frontend: `lib/format.toNum`).
- **JWT-Secret**: ohne `JWT_SECRET` (≥32 Zeichen) nur Dev-Fallback — in `.env` setzen.
- **Auth-Kapselung**: `projekte`/`lvs`/`kalkulation` setzen `app.addHook('onRequest', app.authenticate)` plugin-lokal; nur weil jede Routendatei als eigenes `register()`-Plugin läuft, leakt der Hook nicht auf `/auth/login`.

## Projektübersicht

LV-Manager ist eine interne Desktop-App für SIMA Architecture (Julius Sima, Wien) zur Erstellung, Kalkulation und Verwaltung von Leistungsverzeichnissen (LV) nach ÖNORM. Die App ersetzt manuelle Excel-Workflows und ermöglicht strukturierte Angebotserstellung mit tiefer Kalkulation.

Interne Nutzung, 2–5 Personen im Büro.

---

## Architektur

```
Desktop App (Tauri + React)
        ↓ REST API + JWT
Fastify API Server (Node.js)
        ↓ Prisma ORM
PostgreSQL (eigener Server)
        ↑
MCP Server (Node.js) ← Claude-Zugang
```

Alle Komponenten liegen im Monorepo unter `/packages`.

---

## Tech Stack

| Schicht | Technologie |
|---|---|
| Desktop-Shell | Tauri v2 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| API | Fastify (Node.js) |
| ORM | Prisma |
| Datenbank | PostgreSQL |
| Auth | JWT + bcrypt |
| MCP Server | @modelcontextprotocol/sdk (Node.js) |
| PDF Export | Puppeteer |
| Excel Export | ExcelJS |

---

## Monorepo-Struktur

```
lv-manager/
├── packages/
│   ├── desktop/          # Tauri + React Frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   └── src-tauri/
│   ├── api/              # Fastify REST API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── plugins/
│   │   │   └── services/
│   │   └── prisma/
│   │       └── schema.prisma
│   └── mcp/              # MCP Server für Claude-Zugang
│       └── src/
│           └── tools/
├── package.json          # Workspace root (pnpm)
└── CLAUDE.md
```

---

## Datenmodell (Übersicht)

### Kern-Entitäten

- **User** — Benutzerkonto mit Rolle (admin, editor, viewer)
- **Projekt** — übergeordnete Einheit, enthält mehrere LVs
- **LV (Leistungsverzeichnis)** — versioniert (v1, v2, …), gehört zu einem Projekt
- **LVTitel** — hierarchische Gliederung im LV (Titel > Untertitel)
- **Position** — einzelne Leistungsposition, gehört zu einem Titel
- **Kalkulation** — Aufschlüsselung pro Position (Lohn, Material, Geräte, NU, Zuschläge)
- **KatalogPosition** — importierbare Standardtexte aus LB-H / LB-HB
- **Angebot** — Snapshot eines LV zu einem Zeitpunkt, exportierbar

### Wichtige Beziehungen

```
Projekt 1──n LV 1──n LVTitel 1──n Position 1──1 Kalkulation
                                    └── KatalogPosition (optional)
LV 1──n Angebot
```

---

## Kalkulations-Engine

Jede Position hat eine Kalkulation mit folgenden Ebenen:

```
Einheitspreis (EP) =
  Lohn        (Aufwandswert [h/Einheit] × Stundensatz [€/h])
+ Material    (Summe Materialpositionen mit Aufschlag)
+ Geräte      (Gerätepositionen)
+ Nachuntern. (NU-Kosten pauschal oder aufgeschlüsselt)
+ Sonstiges

Vor Zuschläge (VZ) = EP × Menge

Gesamtpreis   = VZ × (1 + AGK%) × (1 + GU%) × (1 + Gewinn%)
```

---

## API-Routen (Übersicht)

```
POST   /auth/login
POST   /auth/logout

GET    /projekte
POST   /projekte
GET    /projekte/:id
PUT    /projekte/:id
DELETE /projekte/:id

GET    /projekte/:id/lvs
POST   /projekte/:id/lvs
GET    /lvs/:id
PUT    /lvs/:id
POST   /lvs/:id/version      # neue Version erstellen

GET    /lvs/:id/positionen
POST   /lvs/:id/positionen
PUT    /positionen/:id
DELETE /positionen/:id

GET    /positionen/:id/kalkulation
PUT    /positionen/:id/kalkulation

GET    /katalog/search?q=...

POST   /angebote             # aus LV generieren
GET    /angebote/:id/pdf
GET    /angebote/:id/excel
```

---

## MCP Server — Tools

Der MCP Server läuft separat und gibt Claude direkten Lesezugriff auf die Datenbank. Er ist read-heavy, Schreiboperationen nur wo explizit sinnvoll.

```
get_projekte()
get_projekt(id)
get_lv(id)
get_positionen(lv_id)
get_kalkulation(position_id)
search_katalog(query)
get_angebot(id)
create_angebot(lv_id)        # schreibend
summarize_lv(lv_id)          # Claude-generiert
```

---

## Design

Alle visuellen Outputs (PDF-Angebote, Excel-Exporte, UI) folgen dem SIMA Architecture Design System:
- Primärfarbe: Schwarz / Off-White
- Schrift: Aktiv Grotesk (Headings), Inter (Body/UI)
- Logo und Briefkopf: SIMA Architecture, DI Julius Sima, Wien

Details siehe `/packages/desktop/src/design-tokens`.

---

## Entwicklungskonventionen

- **Sprache**: TypeScript überall, strict mode
- **Packagemanager**: pnpm mit Workspaces
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`)
- **Datenbankmigrationen**: immer über `prisma migrate dev`, nie manuell
- **Auth**: JWT im Authorization Header (`Bearer ...`), kein Cookie-Auth
- **Fehlerbehandlung**: alle API-Fehler als `{ error: string, code: string }`
- **Umgebungsvariablen**: `.env` Dateien pro Package, niemals ins Git

---

## Entwicklungsreihenfolge

1. Prisma Schema + PostgreSQL aufsetzen
2. Fastify API mit Auth
3. MCP Server
4. React Frontend — Projektverwaltung
5. LV-Editor (Kern-Feature)
6. Kalkulations-Engine
7. Katalog-Import (ÖNORM LB-H)
8. PDF + Excel Export
9. Tauri Desktop-Shell
