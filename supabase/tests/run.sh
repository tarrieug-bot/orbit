#!/usr/bin/env bash
# =============================================================================
# Applique les migrations + seed sur une base PostgreSQL 16 JETABLE puis lance
# les tests RLS. Ne touche jamais une base Supabase réelle.
#
#   supabase/tests/run.sh            # conteneur docker postgres:16, sinon cluster local (initdb)
#   DATABASE_URL=postgres://… supabase/tests/run.sh   # base vide fournie par vous
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

PSQL_OPTS=(-v ON_ERROR_STOP=1 -q -X)
CLEANUP=""

cleanup() { eval "$CLEANUP"; }
trap cleanup EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  if docker run -d --rm --name orbit-rls-test -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16 >/dev/null 2>&1; then
    CLEANUP="docker rm -f orbit-rls-test >/dev/null 2>&1 || true"
    DATABASE_URL="postgres://postgres:test@127.0.0.1:55432/postgres"
    for _ in $(seq 1 30); do pg_isready -q -d "$DATABASE_URL" && break; sleep 1; done
    sleep 1
  else
    PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/16/bin 2>/dev/null || dirname "$(command -v initdb)")}"
    DIR="$(mktemp -d)"
    chmod 777 "$DIR"
    RUN_AS=()
    [[ "$(id -u)" == "0" ]] && RUN_AS=(runuser -u postgres --)
    "${RUN_AS[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
    "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p 55433 -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
    CLEANUP="${RUN_AS[*]} $PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null 2>&1 || true; rm -rf $DIR"
    DATABASE_URL="postgresql://postgres@/postgres?host=$DIR&port=55433"
  fi
fi

echo "→ simulation du schéma auth"
psql "${PSQL_OPTS[@]}" -d "$DATABASE_URL" -f supabase/tests/00_auth_mock.sql
for f in supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  psql "${PSQL_OPTS[@]}" -d "$DATABASE_URL" -f "$f"
done
echo "→ seed.sql"
psql "${PSQL_OPTS[@]}" -d "$DATABASE_URL" -f supabase/seed.sql
psql -X -A -t -d "$DATABASE_URL" -c "select 'marques: '||(select count(*) from brands)||', comptes: '||(select count(*) from social_accounts)||', métriques: '||(select count(*) from account_daily_metrics)||', publications: '||(select count(*) from posts)"
echo "→ tests RLS"
psql "${PSQL_OPTS[@]}" -d "$DATABASE_URL" -f supabase/tests/rls_test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
