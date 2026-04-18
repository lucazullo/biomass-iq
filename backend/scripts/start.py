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
