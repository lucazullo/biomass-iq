import uuid

from sqlalchemy import String, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Measurement(Base):
    __tablename__ = "measurement"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sample_record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sample_record.id"), nullable=False)
    property_code: Mapped[str] = mapped_column(String(50), ForeignKey("property_definition.code"), nullable=False)

    # Original values as reported
    original_value: Mapped[float] = mapped_column(Float, nullable=False)
    original_unit: Mapped[str] = mapped_column(String(50), nullable=False)
    original_basis: Mapped[str] = mapped_column(String(20), nullable=False)  # ar, dry, daf

    # Normalized values (after basis conversion)
    normalized_value: Mapped[float | None] = mapped_column(Float)
    normalized_unit: Mapped[str | None] = mapped_column(String(50))
    normalized_basis: Mapped[str | None] = mapped_column(String(20))

    # Lineage
    derivation: Mapped[str] = mapped_column(String(20), nullable=False, default="observed")  # observed, converted, imputed
    conversion_note: Mapped[str | None] = mapped_column(Text)
    quality_flag: Mapped[str | None] = mapped_column(String(50))  # suspect_range, duplicate_candidate, etc.

    sample_record: Mapped["SampleRecord"] = relationship(back_populates="measurements")
    property_def: Mapped["PropertyDefinition"] = relationship()
