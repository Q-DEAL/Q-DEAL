#!/usr/bin/env bash
# (Re)creates the qdeal database: schema, privacy rules, api functions and demo data.
# Run automatically when the Codespace is created; safe to run again to reset the data.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1; then
  echo "Installation du client PostgreSQL…"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client >/dev/null
fi

until pg_isready -q; do
  echo "En attente de PostGIS…"
  sleep 2
done

psql -v ON_ERROR_STOP=1 -q \
  -c "SET client_min_messages = warning" \
  -f sql/01_schema.sql \
  -f sql/02_privacy.sql \
  -f sql/03_api.sql \
  -f seed.sql

echo "Base qdeal prête : $(psql -At -c 'SELECT count(*) FROM core.providers') prestataires, $(psql -At -c 'SELECT count(*) FROM core.missions') missions."
echo "Lancer les tests : bash db/scripts/test.sh"
