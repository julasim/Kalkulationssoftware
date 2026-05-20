# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Befehle

Alle Befehle vom Repo-Root (pnpm Workspaces):

```bash
pnpm install                  # einmalig, installiert alle Packages
pnpm --filter api db:generate # Prisma Client generieren (NÖTIG vor erstem build/dev)

pnpm dev:api                  # Fastify API (tsx watch, Port 3000)
pnpm dev:mcp                  # MCP Server (stdio)
pnpm dev:desktop              # Vite Dev-Server (Port 5173)

pnpm build                    # baut api + desktop (tsc / vite)
pnpm db:migrate               # prisma migrate dev (Schema-Änderungen)
pnpm db:studio                # Prisma Studio
pnpm db:seed                  # prisma/seed.ts  (Datei existiert noch nicht)
```

Tauri-Shell (in `packages/desktop`): `pnpm tauri:dev` / `pnpm tauri:build` — **`src-tauri/` ist noch nicht initialisiert**, muss erst per `pnpm tauri init` angelegt werden.

Es gibt **kein Test-Setup** (kein Vitest/Jest, keine Test-Skripte). Verifikation läuft über `tsc` (strict) und manuelles Ausführen.

## Aktueller Implementierungsstand

Die Architektur unten ist die **Ziel-Spezifikation**, nicht der Ist-Zustand. Tatsächlich vorhanden:

- **API** (`packages/api/src/index.ts`): nur ein einziges File. Auth + JWT + CORS sind registriert, aber alle Routen außer `/health` geben `501 NOT_IMPLEMENTED` zurück. Die in der Spec genannten `routes/`, `plugins/`, `services/`-Ordner existieren noch nicht — beim Implementieren neu anlegen.
- **Prisma** (`packages/api/prisma/schema.prisma`): Schema ist vollständig modelliert (User, Projekt, LV, LVTitel, Position, Kalkulation + 5 Kalkulations-Zeilentypen, KatalogPosition, Angebot). Es gibt **noch keine Migrationen** — der erste `prisma migrate dev` legt sie an.
- **MCP** (`packages/mcp/src/index.ts`): voll funktionsfähig, 7 read-Tools + `create_angebot`. Nutzt direkt PrismaClient (kein API-Umweg).
- **Desktop** (`packages/desktop/src`): React-Router-Gerüst mit Seiten-Stubs (`pages/`), zentraler API-Client in `src/lib/api.ts` (modul-lokaler In-Memory-Token via `setToken`).

## Stolperfallen

- **MCP-Package fehlt `zod`**: `packages/mcp/src/index.ts` importiert `zod`, aber es steht nicht in `packages/mcp/package.json`. Vor `dev:mcp`/`build` ergänzen.
- **Prisma Client vor Build generieren**: api und mcp importieren `@prisma/client`. Nach `pnpm install` bzw. Schema-Änderung zuerst `db:generate`, sonst Build-/Typfehler.
- **Top-Level `await`** wird in api/mcp `index.ts` genutzt (tsconfig: `module: NodeNext`, `target: ES2022`). Beibehalten.
- **Decimal-Felder**: Prisma liefert `Decimal`-Objekte (nicht `number`). Beim Rechnen wie im MCP per `Number(...)` konvertieren.
- **JWT-Secret**: API fällt ohne `JWT_SECRET` auf ein Dev-Default zurück — für echten Betrieb in `.env` setzen.

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
