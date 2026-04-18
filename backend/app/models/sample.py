import uuid

from sqlalchemy import String, Integer, Boolean, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SampleRecord(Base):
    __tablename__ = "sample_record"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    substance_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_substance.id"), nullable=False)
    source_dataset: Mapped[str] = mapped_column(String(50), nullable=False)  # phylis, inl, csiro
    source_record_id: Mapped[str] = mapped_column(String(100), nullable=False)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    geography: Mapped[str | None] = mapped_column(String(200))
    year: Mapped[int | None] = mapped_column(Integer)
    process_state: Mapped[str | None] = mapped_column(String(200))
    remarks: Mapped[str | None] = mapped_column(Text)
    citation: Mapped[str | None] = mapped_column(Text)
    citation_url: Mapped[str | None] = mapped_column(Text)
    citation_year: Mapped[int | None] = mapped_column(Integer)
    submitter: Mapped[str | None] = mapped_column(String(300))
    ash_type: Mapped[str | None] = mapped_column(Text)
    is_grouped_average: Mapped[bool] = mapped_column(Boolean, default=False)
    mapping_confidence: Mapped[float | None] = mapped_column(Float)

    substance: Mapped["CanonicalSubstance"] = relationship(back_populates="sample_records")
    measurements: Mapped[list["Measurement"]] = relationship(back_populates="sample_record")
