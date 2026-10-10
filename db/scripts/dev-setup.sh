#!/usr/bin/env bash
# Development only: rebuilds the local qdeal database from the migrations, adds the API's
# development login and loads the fictional Strasbourg fixtures. Runs when the Codespace is
# created; run it again to reset the data.
set -euo pipefail
cd "$(dirname "$0")/../.."
export DBMATE_MIGRATIONS_DIR=db/migrations DBMATE_NO_DUMP_SCHEMA=true

case "${DATABASE_URL:-}" in
  postgres://*@localhost:*/*|postgres://*@127.0.0.1:*/*) ;;
  "") echo "DATABASE_URL is not set." >&2; exit 1 ;;
  *) host=${DATABASE_URL#*@}
     echo "dev-setup.sh only runs against a local database, not ${host%%[:/]*}." >&2
     exit 1 ;;
esac

dbmate wait
db_name=$(basename "${DATABASE_URL%%\?*}")
PGOPTIONS='-c client_min_messages=warning' psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS \"${db_name}\" WITH (FORCE)"
dbmate up

psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qdeal_api') THEN
    CREATE ROLE qdeal_api LOGIN PASSWORD 'qdeal_api';  -- development password only
  END IF;
END
$$;
GRANT qdeal_app TO qdeal_api;
SQL
psql -X -q -v ON_ERROR_STOP=1 -f db/fixtures/dev.sql

echo "Base ${db_name} prête : $(psql -X -At -c 'SELECT count(*) FROM core.providers') prestataires, $(psql -X -At -c 'SELECT count(*) FROM core.missions') missions (fictifs)."
echo "Tests : bash db/scripts/test.sh"
