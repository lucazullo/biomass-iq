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

# Schema init is fast — run it synchronously so the API has tables ready
python scripts/init_schema.py || echo "init_schema.py reported errors but continuing"

# Ingestion is slow (~2-3 min for 75K measurements) — run it in the background
# so uvicorn can start accepting traffic and Railway's healthcheck passes.
python scripts/ingest_phylis.py &
INGEST_PID=$!
echo "PHYLIS ingestion started in background (pid=$INGEST_PID)"

# Start the web server
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
