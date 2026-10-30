#!/bin/sh
# Local test of the SoCal EBUS email activation cutoff (migration 20261030000000) on a throwaway Postgres in Docker.
# Usage: sh supabase/tests/socal-ebus-email-cutoff/run.sh [container]   (default container: a fresh postgres:17-alpine)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd)
C=${1:-}
if [ -z "$C" ]; then
  C=socal-ebus-cutoff-test-$$
  docker run -d --rm --name "$C" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
  trap 'docker stop "$C" >/dev/null 2>&1 || true' EXIT
  for i in $(seq 1 30); do docker exec "$C" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
  sleep 1
fi
DB=socal_ebus_cutoff_test
docker exec "$C" psql -qU postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
run() { docker exec -i "$C" psql -qU postgres -d "$DB" -v ON_ERROR_STOP=1 "$@"; }
run < "$HERE/00_stubs.sql"
# plain Postgres has no pg_net: drop its create-extension line and use the recording net.http_post stand-in from 00_stubs.sql
sed '/create extension if not exists pg_net/d' "$ROOT/supabase/migrations/20260430180000_add_socal_ebus_email_notifications.sql" | run
run < "$HERE/10_history.sql"
run < "$ROOT/supabase/migrations/20261030000000_socal_ebus_email_activation_cutoff.sql"
run < "$HERE/20_cases.sql"
docker exec "$C" psql -qU postgres -c "drop database $DB with (force)"
