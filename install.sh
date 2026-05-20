#!/usr/bin/env bash
#
# install.sh — Setup & Start des Kalkulationssoftware-Compose-Projekts.
#
# Idempotent: mehrfach ausführbar. Eine vorhandene .env wird NICHT verändert.
# - Prüft Docker + Docker Compose
# - Erzeugt .env aus .env.example mit sicheren Zufallswerten (falls nicht vorhanden)
# - Startet das Compose-Projekt (db/api/web) und baut die Images
# - Legt den Erst-Admin an (db:seed) mit kleiner Retry-Schleife
#
set -euo pipefail

# In das Verzeichnis dieses Skripts wechseln (Projektwurzel).
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# ─── 1. Voraussetzungen prüfen ───────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "FEHLER: 'docker' ist nicht installiert oder nicht im PATH." >&2
  echo "        Bitte Docker Engine installieren: https://docs.docker.com/engine/install/" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "FEHLER: 'docker compose' (Compose v2) ist nicht verfügbar." >&2
  echo "        Bitte das Docker-Compose-Plugin installieren." >&2
  exit 1
fi

# ─── 2. .env erzeugen (nur falls nicht vorhanden) ────────────────────────────
gen_secret_b64() {
  # 48 Bytes -> base64; Fallback ohne openssl.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48
  else
    head -c 32 /dev/urandom | base64
  fi
}

gen_password_hex() {
  # 24 Bytes -> hex; Fallback ohne openssl.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    head -c 32 /dev/urandom | base64
  fi
}

if [ -f "$ENV_FILE" ]; then
  echo "Hinweis: '$ENV_FILE' existiert bereits — wird unverändert übernommen."
else
  if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "FEHLER: weder '$ENV_FILE' noch '$ENV_EXAMPLE' vorhanden." >&2
    exit 1
  fi
  echo "Erzeuge '$ENV_FILE' aus '$ENV_EXAMPLE' mit sicheren Zufallswerten ..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  JWT_SECRET_VALUE="$(gen_secret_b64)"
  POSTGRES_PASSWORD_VALUE="$(gen_password_hex)"

  # Platzhalterzeilen ersetzen. '|' als sed-Trenner, da base64 '/' enthalten kann.
  # Variablenwerte vor der Verwendung in sed gegen '|', '&' und '\' absichern.
  esc() { printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'; }
  sed -i \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(esc "$JWT_SECRET_VALUE")|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(esc "$POSTGRES_PASSWORD_VALUE")|" \
    "$ENV_FILE"

  echo "  -> JWT_SECRET und POSTGRES_PASSWORD wurden zufällig gesetzt."
fi

# HTTP_PORT für die Abschluss-Ausgabe einlesen (Default 80).
HTTP_PORT="$(sed -n 's|^HTTP_PORT=\(.*\)$|\1|p' "$ENV_FILE" | head -n1)"
HTTP_PORT="${HTTP_PORT:-80}"

# ─── 3. Compose starten + Images bauen ───────────────────────────────────────
echo "Baue Images und starte Container (db/api/web) ..."
docker compose up -d --build

# ─── 4. Erst-Admin anlegen (Seed) mit Retry-Schleife ─────────────────────────
# 'api' fährt evtl. noch hoch (Migrationen laufen beim Start im Container).
echo "Lege Erst-Admin an (db:seed) — warte ggf. auf den API-Start ..."
SEED_OK=0
for attempt in $(seq 1 30); do
  if docker compose exec -T api corepack pnpm --filter api db:seed; then
    SEED_OK=1
    break
  fi
  echo "  Versuch ${attempt}/30 fehlgeschlagen — API noch nicht bereit, neuer Versuch in 5s ..."
  sleep 5
done

if [ "$SEED_OK" -ne 1 ]; then
  echo "WARNUNG: Seed konnte nicht ausgeführt werden. Bitte später manuell nachholen:" >&2
  echo "         docker compose exec -T api corepack pnpm --filter api db:seed" >&2
fi

# ─── 5. Abschluss-Ausgabe ─────────────────────────────────────────────────────
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
SERVER_IP="${SERVER_IP:-<server-ip>}"

cat <<EOF

════════════════════════════════════════════════════════════════════════════
  Setup abgeschlossen.

  Web-UI erreichbar unter:   http://${SERVER_IP}:${HTTP_PORT}

  Admin-Login: siehe SEED_ADMIN_EMAIL in .env.
  Passwort:    SEED_ADMIN_PASSWORD aus .env — falls leer, gilt 'changeme123'
               (bitte nach dem ersten Login unbedingt ändern).

  ÖNORM-Katalog (LB-HB) importieren — .onlb-Datei in den api-Container kopieren
  und Import starten:

    docker compose cp ./LB-HB-023-2021.onlb api:/tmp/katalog.onlb
    docker compose exec -T api corepack pnpm --filter api db:import-onlb /tmp/katalog.onlb
════════════════════════════════════════════════════════════════════════════
EOF
