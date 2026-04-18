"""
BiomassIQ backend startup — minimal wrapper around uvicorn.

DB schema creation and PHYLIS ingestion are handled inside the FastAPI app's
startup hook (see app/main.py) in a background thread, so they never block
the healthcheck.

Using Python (not bash) to ensure this runs cleanly on any base image.
"""

import os
import sys


def resolve_port() -> int:
    """Listen on whatever PORT Railway sets. Each Railway service runs in its own
    container, so even if PORT=5432 (Postgres's port) is injected into this service's
    env by an addon, there's no real conflict — we still bind 0.0.0.0:$PORT so
    Railway's proxy finds us."""
    raw = os.environ.get("PORT", "8080")
    try:
        return int(raw)
    except ValueError:
        print(f"PORT={raw!r} is not an integer — defaulting to 8080", flush=True)
        return 8080


def main() -> None:
    port = resolve_port()
    print("=== BiomassIQ backend startup ===", flush=True)
    print(f"HTTP port: {port}", flush=True)
    print(f"DATABASE_URL present: {'yes' if os.environ.get('DATABASE_URL') else 'no'}", flush=True)

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
