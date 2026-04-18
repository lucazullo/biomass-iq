from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SourceStatus(Base):
    """Per-source ingest + upstream-drift tracking.

    One row per external biomass database (e.g. "phylis", "inl", "csiro").
    The scheduler updates `last_checked_at` + `upstream_record_count` on each
    periodic check; ingest updates `last_ingested_at` + `known_record_count`
    and clears the `needs_update` flag.
    """

    __tablename__ = "source_status"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. "phylis"
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active | planned

    last_ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    known_record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    upstream_record_count: Mapped[int | None] = mapped_column(Integer)
    needs_update: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_check_error: Mapped[str | None] = mapped_column(Text)
