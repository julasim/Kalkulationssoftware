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

**Durchstich M0–M4** (live auf VPS unter `https://kalkulation.sima.business`): Login → Projekt → LV → Position aus ÖNORM-Katalog → Kalkulation → Summen.

**Phase 1 — Leistungsbücher (fertig):** mehrere ÖNORM-`.onlb` über die Web-UI hochladen/verwalten („Leistungsbücher" 📚), Hintergrund-Import mit Fortschritt, Katalog-Filter nach Buch.

**Phase 2a — Betriebsmittel-Stammdaten (fertig):** zentrale, wiederverwendbare Betriebsmittel (Löhne/Material/Geräte/Sonstiges/NU) + Zuschlagsschemata, verwaltet unter „Stammdaten" 🗂️ (Admin-Writes).

**Phase 2b — strukturierte EP-Aufgliederung (fertig):** Kalkulation läuft über eine vereinheitlichte `Kalkulationszeile` (Kosten = `menge × einzelpreis × (1+aufschlag/100)`), die optional ein Betriebsmittel referenziert (Snapshot beim Übernehmen). UI: Lohn+Sonstiges Standard, Material/Geräte/NU auf Klick; „Zuschlagsschema anwenden". Die alten 5 `Kalkulation*`-Zeilentabellen sind abgelöst.

**Phase 3 — LV-Struktur & Position-Editing (fertig):** 2-Ebenen-Titel (Titel > Untertitel > Position) via `LVTitel.parentId`; OZ-Automatik (`POST /lvs/:id/ordnungszahlen` → `01 / 01.01 / 01.01.NN`); Positions-Kennzeichen `entfaellt` (aus Summen ausgenommen, in MCP+UI); Inline-Editing (Kurztext/Einheit/Menge/Typ/Langtext-Textfeld); Hoch/Runter-Sortierung + Verschieben zwischen Titeln (kein Drag&Drop). Titel-Löschen kaskadiert Untertitel im Route-Code.

- **API** (`packages/api/src`): `app.ts` (Instanz + `@fastify/multipart` + Job-Recovery), `plugins/` (prisma, auth mit `authenticate` **und** `requireAdmin`), `routes/` (health, auth, katalog, leistungsbuecher, **betriebsmittel**, projekte, lvs, kalkulation) unter `/api`, `services/` (`kalkulation.ts` Engine [zeilen-basiert], `onlb-parser.ts`, `leistungsbuch-import.ts` + `import-runner.ts`).
- **Prisma**: Migrationen `0_init` · `20260520120000_leistungsbuecher` (Backfill) · `20260520130000_betriebsmittel` · `20260520140000_kalkulationszeile` (Reset). Entitäten: User, Projekt, LV, LVTitel, Position, Kalkulation, **Kalkulationszeile**, KatalogPosition, Leistungsbuch, ImportJob, **Betriebsmittel**, **Zuschlagsschema**, Angebot. Seed: Admin + Standard-Zuschlagsschema.
- **Katalog-Import**: `services/onlb-parser.ts` (`parse()`, A2063:2021) für CLI (`db:import-onlb --dry`) **und** Web-Upload. LB-HB-023 ≈ 19.700 Positionen.
- **Web** (`packages/desktop/src`): Auth-Context, Seiten Projekte/LVEditor/**Kalkulation** (EP-Aufgliederung)/Katalog/**Leistungsbuecher**/**Stammdaten**, Modals `KatalogPicker` + `BetriebsmittelPicker`, `lib/api` (`upload()`/`patch()`).
- **MCP** (`packages/mcp/src/index.ts`): read-Tools + `create_angebot` (`get_kalkulation` liefert `zeilen[]`).

**Noch offen:** siehe Roadmap (LV-Struktur/Position-Editing → `.onlv` → PDF-Ausgabe → NU-Vergabe).

## Roadmap & Vision

Ziel: fokussiertes **ÖNORM-AVA-Tool** (Ausschreibung/Kalkulation) in Anlehnung an NEVARIS Build / ABK. Bestätigte Richtung (Julius):
- **Kalkulation = Stammdaten/Betriebsmittel-Modell** (zentrale Löhne/Material/Geräte/NU, in Positionen referenziert; Mittellohn, Zuschlagsschema, EP-Aufgliederung mit Formeln/Variablen/Unterpositionen). Die heutige einfache Kalkulation (`Kalkulation*`-Tabellen) wird dabei abgelöst → **nicht weiter ausbauen**.
- **ÖNORM `.onlv`-Im-/Export** früh einplanen (Austausch mit Bauherren/anderer Software).
- ÖNORM-Standardpositionen bleiben **read-only**; Anpassen später via „Kopieren & anpassen" in einen eigenen Stammkatalog (`Leistungsbuch.typ = eigen`).

Phasen:
1. ✅ **Leistungsbücher** — Web-Upload & Verwaltung.
2. ✅ **Stammdaten/Betriebsmittel + tiefere Kalkulation** — 2a Stammdaten (Betriebsmittel/Zuschlagsschema) + 2b vereinheitlichte `Kalkulationszeile` mit Betriebsmittel-Bezug (Snapshot). *Hinweis: Lohn vorerst als einfache Stundensätze (kein Mittellohn); keine freie Formel-Engine — beides bei Bedarf später.*
3. ✅ **LV-Struktur & Position-Editing** — 2-Ebenen-Titel, OZ-Automatik, `entfaellt`-Kennzeichen, Inline-Editing, Hoch/Runter + Verschieben. *(Drag&Drop, Rich-Langtext/Lücken, Mengenberechnung, weitere Kennzeichen Fixpreis/intern bewusst später.)*
4. **`.onlv` Im-/Export** (A2063, nächster Fokus) — Projekt-LVs mit Bauherren/anderer Software austauschen; LV-Struktur/OZ ist nun vorhanden.
5. **PDF-/Angebots-Ausgabe** — Deckblatt, Positionsliste, Layout, Berichte.
6. **NU-Vergabe & Auswertungen**; später Abrechnung/Nachträge/Bautagebuch.

## Stolperfallen

- **Prisma Client vor Build generieren**: nach `pnpm install` bzw. Schema-Änderung zuerst `pnpm db:generate`, sonst Typfehler.
- **Top-Level `await`** in api/mcp (tsconfig: `module: NodeNext`/`ESNext`, `target: ES2022`). Beibehalten.
- **Decimal-Felder**: Prisma liefert `Decimal` (JSON-serialisiert als **String**). Vor Rechnen per `Number(...)` konvertieren (Frontend: `lib/format.toNum`).
- **JWT-Secret**: ohne `JWT_SECRET` (≥32 Zeichen) nur Dev-Fallback — in `.env` setzen.
- **Auth-Kapselung**: `projekte`/`lvs`/`kalkulation` setzen `app.addHook('onRequest', app.authenticate)` plugin-lokal; nur weil jede Routendatei als eigenes `register()`-Plugin läuft, leakt der Hook nicht auf `/auth/login`.
- **Import-Job**: ONLB-Upload läuft als In-Process-Hintergrund-Job (`services/import-runner.ts`, fire-and-forget); Status/Fortschritt in `ImportJob`, Frontend pollt `GET /leistungsbuecher/imports/:id`. Beim API-Start werden hängengebliebene `running`-Jobs auf `error` gesetzt (`app.ts`). Kein Redis/Queue — bewusst.
- **Admin-Routen**: Upload/PATCH/DELETE der Leistungsbücher nutzen `app.requireAdmin` (403 wenn `role≠admin`); das Frontend blendet diese Aktionen für Nicht-Admins aus.
- **Migration mit Backfill**: `20260520120000_leistungsbuecher` ist handgeschrieben (Backfill bestehender KatalogPositionen → Leistungsbuch über `kennung`+`versionsnummer`, dann NOT NULL/Unique/FK). `prisma migrate dev` erzeugt Datentransfers NICHT automatisch — handschriftlich schreiben und nur den DDL-Teil gegen `prisma migrate diff` gegenprüfen (kein lokales Postgres).
- **Seed-Passwort**: `prisma/seed.ts` nutzt `process.env.X || 'default'` (nicht `??`), damit ein leerer `.env`-String auf den Default fällt; `db:seed` setzt das Admin-Passwort beim erneuten Lauf zurück.
- **Kalkulationszeile / Betriebsmittel-Snapshot**: Eine Zeile (`art` lohn|material|geraet|sonstiges|nu) kann ein `Betriebsmittel` referenzieren, kopiert dessen Werte aber als **Snapshot** (Preis/Einheit). Spätere Stammdaten-Preisänderung wirkt NICHT rückwirkend (`betriebsmittelId` FK `SET NULL` bei Löschen). Kosten generisch = `menge × einzelpreis × (1+aufschlag/100)`; NU/Sonstiges: `menge=1`, `einzelpreis=Betrag`. Stammdaten-Schreibrechte = `requireAdmin`.

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
- **Kalkulation** — pro Position (1:1); hält Zuschläge (agk/gu/gewinn) + berechneten `einheitspreis`/`gesamtpreis`
- **Kalkulationszeile** — vereinheitlichte Zeile (`art` lohn|material|geraet|sonstiges|nu); Kosten `menge × einzelpreis × (1+aufschlag/100)`; optional `betriebsmittelId` (Snapshot). Löst die alten 5 `Kalkulation*`-Tabellen ab.
- **Betriebsmittel** — zentrales Stammdaten-Kostenmittel (`art`, `kostenProEinheit`, `einheit`, `aufschlag`, `aktiv`)
- **Zuschlagsschema** — zentrale Zuschlagssätze (agk/gu/gewinn, `istStandard`)
- **Leistungsbuch** — importiertes ÖNORM-Buch (LB-HB/LB-VI/LB-HT …) oder eigener Stamm; `typ` oenorm|eigen, `aktiv`, `versionsnummer`; gruppiert KatalogPositionen
- **KatalogPosition** — Standardtext eines Leistungsbuchs (`@@unique([leistungsbuchId, posNummer])`)
- **ImportJob** — Status/Fortschritt eines ONLB-Imports (pending/running/done/error)
- **Angebot** — Snapshot eines LV zu einem Zeitpunkt, exportierbar

### Wichtige Beziehungen

```
Projekt 1──n LV 1──n LVTitel 1──n Position 1──1 Kalkulation 1──n Kalkulationszeile
                                    └── KatalogPosition (optional, FK SET NULL)
Kalkulationszeile ──n──1 Betriebsmittel (optional, FK SET NULL, Snapshot)
Leistungsbuch 1──n KatalogPosition (FK CASCADE) · 1──n ImportJob
LV 1──n Angebot
```

---

## Kalkulations-Engine (`services/kalkulation.ts`, reine Funktion)

Jede Kalkulationszeile hat dieselbe Kostenformel:

```
Zeilenkosten = menge × einzelpreis × (1 + aufschlag/100)
  Lohn:        menge = Aufwandswert (h/Einh.), einzelpreis = Stundensatz (€/h)
  Material:    menge, einzelpreis = Preis, aufschlag = %
  Geräte:      menge, einzelpreis = Preis
  NU/Sonstige: menge = 1, einzelpreis = Betrag

EP-Basis      = Σ Zeilenkosten
Einheitspreis = EP-Basis × (1 + AGK%) × (1 + GU%) × (1 + Gewinn%)
Gesamtpreis   = Einheitspreis × Menge   (Position.menge)
```

Betriebsmittel aus den Stammdaten werden beim Übernehmen als Snapshot in die Zeile kopiert (Preisstabilität).

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
GET    /lvs/:id                       # LV-Baum (Titel/Untertitel via parentId + Positionen)
PUT    /lvs/:id
POST   /lvs/:id/titel                 # Titel/Untertitel (parentId) anlegen
PATCH  /titel/:id                     # umbenennen/reihenfolge/parentId (max. 2 Ebenen)
PATCH  /titel/:id/reihenfolge         # { richtung: hoch|runter }
DELETE /titel/:id                     # inkl. Untertitel (Cascade im Code)
POST   /lvs/:id/ordnungszahlen        # OZ neu vergeben (01 / 01.01 / 01.01.NN)

POST   /lvs/:id/positionen            # optional aus KatalogPosition
PUT    /positionen/:id                # Felder + entfaellt + titelId (verschieben) + reihenfolge
PATCH  /positionen/:id/reihenfolge    # { richtung: hoch|runter }
DELETE /positionen/:id

GET    /positionen/:id/kalkulation
PUT    /positionen/:id/kalkulation

GET    /katalog/search?q=...&leistungsbuchId=...   # nur aktive Bücher

GET    /betriebsmittel?art=&aktiv=        # Stammdaten; Writes (POST/PATCH/DELETE) Admin
GET    /zuschlagsschemata                 # POST/PATCH/DELETE Admin; genau ein istStandard

GET    /leistungsbuecher
POST   /leistungsbuecher/import       # multipart .onlb, Admin → 202 + jobId (Hintergrund-Import)
GET    /leistungsbuecher/imports/:id  # Import-Status/Fortschritt (Polling)
PATCH  /leistungsbuecher/:id          # aktiv/bezeichnung, Admin
DELETE /leistungsbuecher/:id          # Admin

POST   /angebote             # aus LV generieren (noch offen)
GET    /angebote/:id/pdf     # noch offen
GET    /angebote/:id/excel   # noch offen
```

> Alle Routen liegen unter dem `/api`-Prefix (z. B. `/api/leistungsbuecher`). `/lvs/:id/version` und `/angebote*` sind noch nicht implementiert (Roadmap).

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

Der ursprüngliche M0–M4-Durchstich **und Phase 1 (Leistungsbücher)** sind erledigt. Der weitere Weg steht oben unter **Roadmap & Vision**. Hinweis: der Erst-Plan-Punkt „Tauri Desktop-Shell" ist **gestrichen** — es bleibt eine Web-App. Die unteren Abschnitte (Tech Stack, Architektur-Diagramm, Kalkulations-Engine) sind teils noch die **ursprüngliche Zielspezifikation**; maßgeblich für den Ist-Zustand sind „Implementierungsstand", „Architektur-Hinweis (Web statt Tauri)" und „Roadmap & Vision".
