#!/usr/bin/env bash
set -e

# Railway's Postgres plugin injects PORT=5432 into linked services, which
# conflicts with the HTTP server port. If PORT is missing or looks like a DB
# port, fall back to 8080 (Railway routes public traffic to whatever we listen on).
if [ -z "$PORT" ] || [ "$PORT" = "5432" ] || [ "$PORT" = "3306" ]; then
  echo "PORT=$PORT looks like a DB port — overriding to 8080"
  PORT=8080
fi

echo "=== BiomassIQ backend startup ==="
echo "HTTP port: $PORT"
echo "DATABASE_URL present: $([ -n "$DATABASE_URL" ] && echo yes || echo no)"

# Run DB init (schema + ingest). Non-fatal on error.
python scripts/init_db.py || echo "init_db.py reported errors but continuing"

# Start the web server
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
