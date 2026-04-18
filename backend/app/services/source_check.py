"""Upstream-drift detection for external biomass databases.

Each source has a lightweight `check_*` function that reports the current
upstream record count. The scheduler compares against `known_record_count`
(set by the last successful ingest) and, if greater, flags the row and
emails the admin.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import SourceStatus
from app.services.email_alerts import send_admin_alert


PHYLIS_BASE = "https://phyllis.nl"
PHYLIS_ROOT_NODE = "class_101"


def _count_phylis_leaves(client: httpx.Client, node_id: str, depth: int = 0, max_depth: int = 8) -> int:
    """Walk the PHYLIS tree recursively and count leaf samples."""
    if depth > max_depth:
        return 0
    resp = client.get(f"{PHYLIS_BASE}/Browse/JsonNodes", params={"id": node_id})
    resp.raise_for_status()
    nodes = resp.json()
    total = 0
    for child in nodes:
        child_id = child.get("id", "")
        if child.get("icon") == "leaf" and child_id.startswith("sample_"):
            total += 1
        elif child_id:
            total += _count_phylis_leaves(client, child_id, depth + 1, max_depth)
    return total


def check_phylis_upstream(timeout: float = 60.0) -> int:
    """Return the current upstream leaf-sample count for PHYLIS."""
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        return _count_phylis_leaves(client, PHYLIS_ROOT_NODE)


# --- CSIRO DAP drift check -----------------------------------------------

CSIRO_DAP_URL = "https://data.csiro.au/dap/ws/v2/collections/csiro:45807"

# Local baseline: the DAP collection version we last ingested (see the folder
# name under backend/app/adapters/csiro/raw_data/). Bumping this requires a
# re-download + re-parse.
CSIRO_LOCAL_VERSION = 69


def check_csiro_upstream(timeout: float = 30.0) -> int:
    """Return the current upstream DAP versionNumber for the CSIRO
    'Database of chemical properties of Australian biomass and waste'
    collection.

    We use versionNumber as the drift signal instead of a sample count:
    CSIRO publishes periodic versioned updates rather than continuously
    appending rows, so a version bump is the right signal to re-ingest.
    """
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        resp = client.get(
            CSIRO_DAP_URL,
            headers={
                "Accept": "application/json",
                "User-Agent": "BiomassIQ/1.0 (+https://biomass-iq.vercel.app)",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return int(data.get("versionNumber") or data.get("dataVersionNumber") or 0)


# Map of source id → its upstream-count checker. Planned sources omitted
# until their adapters exist.
SOURCE_CHECKERS: dict[str, callable] = {
    "phylis": check_phylis_upstream,
    "csiro": check_csiro_upstream,
}


# Sources whose drift signal is a version number (not a record count). For
# these we want the "needs_update" banner logic to key on inequality, not on
# ">" — CSIRO could in principle republish an older version.
VERSION_BASED_SOURCES = {"csiro"}


def run_source_checks(db: Session) -> list[dict]:
    """Iterate over every `active` source with a registered checker, update
    its row, and fire an admin email the first time we notice an increase.

    Returns a summary list suitable for logging / the `/api/sources/check`
    admin endpoint response.
    """
    results: list[dict] = []
    sources = db.query(SourceStatus).filter(SourceStatus.status == "active").all()
    for src in sources:
        checker = SOURCE_CHECKERS.get(src.id)
        if not checker:
            continue
        now = datetime.now(timezone.utc)
        entry = {"id": src.id, "name": src.display_name, "checked_at": now.isoformat()}
        try:
            upstream = int(checker())
            src.last_checked_at = now
            src.upstream_record_count = upstream
            src.last_check_error = None
            was_needs_update = src.needs_update
            entry["upstream"] = upstream
            entry["known"] = src.known_record_count

            drifted = (
                upstream != src.known_record_count
                if src.id in VERSION_BASED_SOURCES
                else upstream > src.known_record_count
            )
            if drifted:
                src.needs_update = True
                # Only email on the transition (first detection since last ingest).
                if not was_needs_update:
                    if src.id in VERSION_BASED_SOURCES:
                        subject = f"[BiomassIQ] {src.display_name} published a new version"
                        body = (
                            f"Source '{src.display_name}' ({src.url}) has a new version upstream.\n\n"
                            f"Ingested version: v{src.known_record_count}\n"
                            f"Upstream version: v{upstream}\n\n"
                            "Re-download the DAP bundle and re-run the ingest to refresh.\n"
                            "Users will see a 'needs update' warning in the Databases panel "
                            "until then.\n\n"
                            "— BiomassIQ scheduler"
                        )
                    else:
                        subject = f"[BiomassIQ] {src.display_name} has new records"
                        body = (
                            f"Source '{src.display_name}' ({src.url}) appears to have new records.\n\n"
                            f"Known count (last ingest): {src.known_record_count}\n"
                            f"Upstream count (just checked): {upstream}\n"
                            f"Delta: +{upstream - src.known_record_count}\n\n"
                            "Users will see a 'needs update' warning in the Databases panel "
                            "until the next ingest clears the flag.\n\n"
                            "— BiomassIQ scheduler"
                        )
                    sent, msg = send_admin_alert(subject=subject, body=body)
                    src.last_notified_at = now if sent else src.last_notified_at
                    entry["email_sent"] = sent
                    entry["email_message"] = msg
            else:
                # Upstream did not grow — ensure the flag is clear.
                src.needs_update = False
            entry["needs_update"] = src.needs_update
        except Exception as exc:  # noqa: BLE001
            src.last_check_error = f"{type(exc).__name__}: {exc}"
            src.last_checked_at = now
            entry["error"] = src.last_check_error
        db.commit()
        results.append(entry)
    return results


# --- Seeding -------------------------------------------------------------

DEFAULT_SOURCES: list[dict] = [
    {
        "id": "phylis",
        "display_name": "PHYLIS",
        "url": "https://phyllis.nl",
        "description": (
            "ECN/TNO biomass characterization database. Broad coverage of lignocellulosic biomass, "
            "agricultural residues, woody materials, and processed fuels."
        ),
        "notes": "Primary anchor dataset.",
        "status": "active",
    },
    {
        "id": "inl",
        "display_name": "INL Bioenergy Feedstock Library",
        "url": "https://bioenergylibrary.inl.gov",
        "description": "Idaho National Laboratory feedstock characterization library.",
        "notes": "Planned second integration.",
        "status": "planned",
    },
    {
        "id": "csiro",
        "display_name": "CSIRO Biomass & Waste Database",
        "url": "https://doi.org/10.25919/3yhq-8a44",
        "description": (
            "CSIRO Database of chemical properties of Australian biomass and waste: "
            "proximate, ultimate, calorific value, and ash chemistry for agricultural, "
            "forestry, industrial and urban-waste feedstocks. CC BY 4.0."
        ),
        "notes": "Versioned DAP collection; drift detection tracks the DAP versionNumber.",
        "status": "active",
    },
]


def seed_sources_if_empty(db: Session) -> None:
    """Populate the source_status table on first boot, and on every subsequent
    boot refresh the descriptive metadata (display_name, url, description,
    notes, status) from `DEFAULT_SOURCES`. The runtime counters
    (known_record_count, last_ingested_at, needs_update, etc.) are never
    overwritten."""
    for spec in DEFAULT_SOURCES:
        existing = db.query(SourceStatus).filter(SourceStatus.id == spec["id"]).one_or_none()
        if existing is None:
            db.add(SourceStatus(**spec))
            continue
        existing.display_name = spec["display_name"]
        existing.url = spec.get("url")
        existing.description = spec.get("description")
        existing.notes = spec.get("notes")
        existing.status = spec.get("status", existing.status)
    db.commit()


def mark_ingested(db: Session, source_id: str, record_count: int) -> None:
    """Called by the ingest pipeline after a successful load/refresh."""
    src = db.query(SourceStatus).filter(SourceStatus.id == source_id).one_or_none()
    if not src:
        return
    src.last_ingested_at = datetime.now(timezone.utc)
    src.known_record_count = record_count
    src.needs_update = False
    src.last_check_error = None
    db.commit()
