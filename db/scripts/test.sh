#!/usr/bin/env bash
# Checks the privacy rules of the location feature (the data is left unchanged).
set -euo pipefail
cd "$(dirname "$0")/.."
psql -X -q -v ON_ERROR_STOP=1 -f tests/localisation_test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
