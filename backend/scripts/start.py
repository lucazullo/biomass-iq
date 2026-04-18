"""
BiomassIQ backend startup script.

Responsibilities:
1. Resolve the HTTP port (override if Railway leaked a DB port).
2. Create the schema synchronously (fast).
3. Kick off PHYLIS ingestion in the background (slow).
4. exec() into uvicorn so the server process replaces this one.

Using Python (not bash) so the flow is cross-platform, produces line-buffered
logs, and is less susceptible to line-ending / executable-bit issues.
"""

import os
import subprocess
import sys
from pathlib import Path

# Ensure the app package is importable from scripts/
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def resolve_port() -> int:
    raw = os.environ.get("PORT", "8080")
    try:
        port = int(raw)
    except ValueError:
        print(f"PORT={raw!r} is not an integer — defaulting to 8080", flush=True)
        return 8080
    if port in (5432, 3306):
        print(f"PORT={port} looks like a DB port — overriding to 8080", flush=True)
        return 8080
    return port


def main() -> None:
    port = resolve_port()
    db_url_present = bool(os.environ.get("DATABASE_URL"))

    print("=== BiomassIQ backend startup ===", flush=True)
    print(f"HTTP port: {port}", flush=True)
    print(f"DATABASE_URL present: {'yes' if db_url_present else 'no'}", flush=True)

    # 1. Schema init (synchronous, ~1-2s)
    try:
        result = subprocess.run(
            [sys.executable, "scripts/init_schema.py"],
            cwd=str(BACKEND_DIR),
            check=False,
        )
        print(f"init_schema exit={result.returncode}", flush=True)
    except Exception as e:
        print(f"init_schema error: {e}", flush=True)

    # 2. PHYLIS ingestion in background (non-blocking, ~2-3 min)
    try:
        subprocess.Popen(
            [sys.executable, "scripts/ingest_phylis.py"],
            cwd=str(BACKEND_DIR),
        )
        print("PHYLIS ingestion launched in background", flush=True)
    except Exception as e:
        print(f"ingestion launch error: {e}", flush=True)

    # 3. exec into uvicorn (replaces this process)
    uvicorn_cmd = [
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", str(port),
    ]
    print(f"exec: {' '.join(uvicorn_cmd)}", flush=True)
    os.execvp(sys.executable, uvicorn_cmd)


if __name__ == "__main__":
    main()
