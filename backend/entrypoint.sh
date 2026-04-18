#!/usr/bin/env bash
set -e

echo "=== BiomassIQ backend startup ==="
echo "Port: ${PORT:-8000}"

# Run DB init (schema + ingest). Non-fatal on error.
python scripts/init_db.py || echo "init_db.py reported errors but continuing"

# Start the web server
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
