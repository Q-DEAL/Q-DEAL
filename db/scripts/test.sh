#!/usr/bin/env bash
# Checks the location feature on throwaway databases, leaving the main one untouched:
#   1. every migration applies to an empty database, rolls back, and applies again;
#   2. the privacy and example-mission rules hold on the development fixtures.
set -euo pipefail
cd "$(dirname "$0")/../.."
export DBMATE_MIGRATIONS_DIR=db/migrations DBMATE_NO_DUMP_SCHEMA=true

base_url=${DATABASE_URL%%\?*}
query=${DATABASE_URL#"$base_url"}
server_url=${base_url%/*}
test_dbs=(qdeal_test_migrations qdeal_test_rules)

drop_test_dbs() {
  for db in "${test_dbs[@]}"; do
    PGOPTIONS='-c client_min_messages=warning' psql -X -q -d postgres -c "DROP DATABASE IF EXISTS ${db} WITH (FORCE)"
  done
}
trap drop_test_dbs EXIT
drop_test_dbs

migrations=$(find db/migrations -name '*.sql' | wc -l)
url="${server_url}/qdeal_test_migrations${query}"
DATABASE_URL=$url dbmate up >/dev/null
for _ in $(seq "$migrations"); do DATABASE_URL=$url dbmate rollback >/dev/null; done
DATABASE_URL=$url dbmate up >/dev/null
echo "ok  0. ${migrations} migrations : application, retour arrière complet et réapplication"

url="${server_url}/qdeal_test_rules${query}"
DATABASE_URL=$url dbmate up >/dev/null
psql -X -q -v ON_ERROR_STOP=1 -d qdeal_test_rules -f db/fixtures/dev.sql
psql -X -q -v ON_ERROR_STOP=1 -d qdeal_test_rules -f db/tests/localisation_test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
